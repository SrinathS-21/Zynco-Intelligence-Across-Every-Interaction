/**
 * CRM Order Action Executor
 * 
 * Creates a sales order in MS Dynamics CRM from an email.
 * Uses Gemini AI to extract order details from email content.
 * Extracted from the monolithic actions.ts.
 */

import { ActionExecutor, ActionResult, EmailForAction } from '../action-registry';
import { createActivityLog, saveActivityLog } from '@/lib/activity-history';
import { decrypt } from '@/lib/encryption';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/db';

// ─── CRM Token Cache ─────────────────────────────────────────────────────

interface CachedToken {
    accessToken: string;
    expiresAt: number;
}

const crmTokenCache = new Map<string, CachedToken>();

async function getCrmAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    instanceUrl: string,
): Promise<string> {
    const cacheKey = `crm-auto:${clientId}`;
    const cached = crmTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.accessToken;
    }

    const resource = instanceUrl.replace(/\/+$/, '');
    const res = await fetch(
        `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                scope: `${resource}/.default offline_access`,
                grant_type: 'refresh_token',
            }),
        },
    );

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`CRM token refresh failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.access_token) {
        throw new Error(`No access_token in CRM token response`);
    }

    const expiresIn = data.expires_in || 3600;
    crmTokenCache.set(cacheKey, {
        accessToken: data.access_token,
        expiresAt: Date.now() + (expiresIn * 1000) - (5 * 60 * 1000),
    });

    return data.access_token;
}

// ─── Gemini AI Extraction ─────────────────────────────────────────────────

async function extractOrderDetailsWithGemini(email: EmailForAction): Promise<{
    isOrder: boolean;
    orderName: string;
    description: string;
    customerName?: string;
    products?: string;
    totalAmount?: number;
}> {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.warn('[CrmAction] No GEMINI_API_KEY, using basic extraction');
        return {
            isOrder: true,
            orderName: `Order from email: ${email.subject}`,
            description: (email.body || email.snippet || '').substring(0, 500),
        };
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const cleanBody = (email.body || email.snippet || '')
        .replace(/<[^>]*>/g, '')
        .substring(0, 3000);

    const prompt = `Analyze this email and determine if it contains an order or purchase request. Extract order details.

Email Subject: ${email.subject}
From: ${email.from}
Body:
${cleanBody}

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "isOrder": true/false,
  "orderName": "Short descriptive name for the order",
  "description": "Brief description of what is being ordered",
  "customerName": "Name of the customer/company if mentioned",
  "products": "Products or services mentioned",
  "totalAmount": null or number if a total amount is mentioned
}

If the email is not about an order/purchase, set isOrder to false and provide minimal fields.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        // Strip markdown code blocks if present
        const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(jsonStr);
        return {
            isOrder: parsed.isOrder ?? true,
            orderName: parsed.orderName || `Order: ${email.subject}`,
            description: parsed.description || email.subject,
            customerName: parsed.customerName,
            products: parsed.products,
            totalAmount: parsed.totalAmount,
        };
    } catch (error) {
        console.error('[CrmAction] Gemini extraction error:', error);
        return {
            isOrder: true,
            orderName: `Order from email: ${email.subject}`,
            description: cleanBody.substring(0, 500),
        };
    }
}

// ─── CRM Customer Management ─────────────────────────────────────────────

async function findOrCreateCrmCustomer(
    accessToken: string,
    instanceUrl: string,
    customerName: string,
    customerEmail: string,
): Promise<Record<string, string>> {
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
    };

    // Extract just the email address if it's in "Name <email>" format
    const emailMatch = customerEmail.match(/<([^>]+)>/);
    const cleanEmail = (emailMatch ? emailMatch[1] : customerEmail).trim().toLowerCase();

    // 1. Try to find an existing Account by name
    try {
        const nameFilter = encodeURIComponent(customerName);
        const acctRes = await fetch(
            `${instanceUrl}/api/data/v9.0/accounts?$filter=contains(name,'${nameFilter}')&$top=1&$select=accountid,name`,
            { headers },
        );
        if (acctRes.ok) {
            const acctData = await acctRes.json();
            if (acctData.value?.length > 0) {
                const accountId = acctData.value[0].accountid;
                console.log('[CrmAction] Found existing account:', acctData.value[0].name, accountId);
                return { 'customerid_account@odata.bind': `/accounts(${accountId})` };
            }
        }
    } catch (e) {
        console.warn('[CrmAction] Account search failed, trying contacts:', e);
    }

    // 2. Try to find an existing Contact by email
    try {
        const contactRes = await fetch(
            `${instanceUrl}/api/data/v9.0/contacts?$filter=emailaddress1 eq '${cleanEmail}'&$top=1&$select=contactid,fullname`,
            { headers },
        );
        if (contactRes.ok) {
            const contactData = await contactRes.json();
            if (contactData.value?.length > 0) {
                const contactId = contactData.value[0].contactid;
                console.log('[CrmAction] Found existing contact:', contactData.value[0].fullname, contactId);
                return { 'customerid_contact@odata.bind': `/contacts(${contactId})` };
            }
        }
    } catch (e) {
        console.warn('[CrmAction] Contact search failed, will create new:', e);
    }

    // 3. No match — create a new Contact
    const nameParts = customerName.split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || customerName;

    try {
        console.log('[CrmAction] Creating new contact for:', customerName, cleanEmail);
        const createRes = await fetch(
            `${instanceUrl}/api/data/v9.0/contacts`,
            {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    firstname: firstName,
                    lastname: lastName,
                    emailaddress1: cleanEmail,
                }),
            },
        );

        if (createRes.ok) {
            const newContact = await createRes.json();
            const contactId = newContact.contactid;
            console.log('[CrmAction] Created new contact:', contactId);
            return { 'customerid_contact@odata.bind': `/contacts(${contactId})` };
        }

        const errText = await createRes.text();
        console.error('[CrmAction] Contact creation failed:', createRes.status, errText);
    } catch (e) {
        console.error('[CrmAction] Contact creation error:', e);
    }

    // 4. Fallback — return empty, let the order attempt proceed anyway
    console.warn('[CrmAction] Could not find or create customer, proceeding without customerid');
    return {};
}

// ─── CRM Order Action ────────────────────────────────────────────────────

export const crmOrderAction: ActionExecutor = {
    type: 'create_crm_order',
    name: 'Create CRM Sales Order',

    async execute(
        email: EmailForAction,
        config: Record<string, any>,
        agentConfig: Record<string, any>,
    ): Promise<ActionResult> {
        const credentialId = config.msDynamicsCredentialId || agentConfig.msDynamics?.credentialId;

        if (!credentialId) {
            return {
                success: false,
                actionType: 'create_crm_order',
                message: 'MS Dynamics CRM not connected. Go to Settings to connect your CRM.',
            };
        }

        try {
            // 1. Use Gemini to analyze email and extract order details
            console.log('[CrmAction] Analyzing email with Gemini:', email.subject);
            const orderDetails = await extractOrderDetailsWithGemini(email);

            if (!orderDetails.isOrder) {
                console.log('[CrmAction] Email is not an order, skipping:', email.subject);
                return {
                    success: true,
                    actionType: 'create_crm_order',
                    message: 'Email analyzed — not an order, skipped.',
                };
            }

            // 2. Fetch and decrypt CRM credential
            const credential = await prisma.credential.findUnique({
                where: { id: credentialId },
            });

            if (!credential) {
                return {
                    success: false,
                    actionType: 'create_crm_order',
                    message: `CRM credential not found (ID: ${credentialId})`,
                };
            }

            let rawValue: string;
            try {
                rawValue = await decrypt(credential.value);
            } catch {
                rawValue = credential.value;
            }

            let credData: { instanceUrl?: string; refreshToken?: string };
            try {
                credData = JSON.parse(rawValue);
            } catch {
                return {
                    success: false,
                    actionType: 'create_crm_order',
                    message: 'Failed to parse CRM credential data',
                };
            }

            if (!credData.instanceUrl || !credData.refreshToken) {
                return {
                    success: false,
                    actionType: 'create_crm_order',
                    message: 'CRM credential missing instanceUrl or refreshToken',
                };
            }

            const clientId = process.env.MS_DYNAMICS_CLIENT_ID;
            const clientSecret = process.env.MS_DYNAMICS_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                return {
                    success: false,
                    actionType: 'create_crm_order',
                    message: 'MS_DYNAMICS_CLIENT_ID or MS_DYNAMICS_CLIENT_SECRET not configured',
                };
            }

            // 3. Get access token
            const accessToken = await getCrmAccessToken(
                clientId,
                clientSecret,
                credData.refreshToken,
                credData.instanceUrl,
            );

            const instanceUrl = credData.instanceUrl.replace(/\/+$/, '');

            // 4. Find or create a customer (contact) in CRM
            const customerBind = await findOrCreateCrmCustomer(
                accessToken,
                instanceUrl,
                orderDetails.customerName || email.from,
                email.from,
            );

            // 5. Create Sales Order in Dynamics CRM
            const orderBody: Record<string, unknown> = {
                name: orderDetails.orderName,
                description: `${orderDetails.description}\n\n---\nAuto-created from email by AI\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date || new Date().toISOString()}`,
                ...customerBind,
            };

            if (orderDetails.totalAmount != null) {
                orderBody.totalamount = orderDetails.totalAmount;
            }

            console.log('[CrmAction] Creating sales order:', orderDetails.orderName);

            const crmResponse = await fetch(
                `${instanceUrl}/api/data/v9.0/salesorders`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'OData-MaxVersion': '4.0',
                        'OData-Version': '4.0',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify(orderBody),
                },
            );

            if (!crmResponse.ok) {
                const errText = await crmResponse.text();
                let errorMsg = `CRM API error (${crmResponse.status})`;
                try {
                    const errJson = JSON.parse(errText);
                    errorMsg = errJson?.error?.message || errorMsg;
                } catch { /* use default */ }
                console.error('[CrmAction] CRM API error:', errorMsg);
                return {
                    success: false,
                    actionType: 'create_crm_order',
                    message: errorMsg,
                };
            }

            const crmData = await crmResponse.json();
            const orderId = crmData.salesorderid || crmData.ordernumber || 'unknown';
            const orderUrl = `${instanceUrl}/main.aspx?etn=salesorder&id=${crmData.salesorderid}&pagetype=entityrecord`;

            console.log('[CrmAction] Created CRM sales order:', orderId);

            // Log activity
            const log = createActivityLog(
                'crm_order',
                `CRM Order Created (Auto): ${orderId}`,
                `Automation rule applied to email "${email.subject}"`,
                'success',
                { tool: 'dynamics_crm', resourceId: orderId, resourceUrl: orderUrl, emailSubject: email.subject },
            );
            await saveActivityLog(prisma, agentConfig.agentId, log);

            return {
                success: true,
                actionType: 'create_crm_order',
                message: `Created CRM Order: ${orderDetails.orderName}`,
                data: {
                    id: orderId,
                    url: orderUrl,
                },
            };
        } catch (error) {
            console.error('[CrmAction] Error:', error);
            return {
                success: false,
                actionType: 'create_crm_order',
                message: `CRM action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    },
};
