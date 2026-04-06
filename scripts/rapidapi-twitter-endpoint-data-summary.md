# RapidAPI Twitter Endpoint Data Snapshot

Generated from scripts/rapidapi-twitter-provider-test-report.json

## twitter241

| Method | Route | Status | Category | Top-level keys | Sample |
|---|---|---:|---|---|---|
| GET | /about-account | 200 | success | (json parse failed) | {"result":{"data":{"user_result_by_screen_name":{"id":"VXNlclJlc3VsdHM6MTQzNDA1Mjk0MA==","result":{"__typename":"UserUnavailable","unavailable_reason":"Suspended"}}}}} |
| GET | /autocomplete | 200 | success | (trimmed preview) | {"result":{"num_results":6,"users":[{"id":2522806836,"id_str":"2522806836","verified":false,"ext_is_blue_verified":true,"badges":[],"is_dm_able":false,"is_secret_dm_able":false,"is_persona_media_genable":false,"is_blocke... |
| GET | /comments | 200 | soft-error | (json parse failed) | {"data":{},"errors":[{"message":"strconv.ParseInt: parsing \"undefined\": invalid syntax","path":["threaded_conversation_with_injections_v2","focal_tweet_id"]}]} |
| GET | /comments-v2 | 200 | soft-error | (json parse failed) | {"data":{},"errors":[{"message":"strconv.ParseInt: parsing \"undefined\": invalid syntax","path":["threaded_conversation_with_injections_v2","focal_tweet_id"]}]} |
| GET | /community-about | 404 | validation-error | (json parse failed) | {"error":true,"code":"error_msg","message":"strconv.ParseInt: parsing \"undefined\": invalid syntax"} |
| GET | /community-details | 404 | validation-error | (json parse failed) | {"error":true,"code":"error_msg","message":"strconv.ParseInt: parsing \"undefined\": invalid syntax"} |
| GET | /community-members | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /community-members-v2 | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /community-moderators | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /community-topics | 200 | success | (trimmed preview) | {"data":{"fetch_user_community_topics":{"community_topics":[{"subtopics":[{"subtopics":[],"topic_id":"2","topic_name":"American Football"},{"subtopics":[],"topic_id":"3","topic_name":"Basketball"},{"subtopics":[],"topic_... |
| GET | /community-tweets | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /explore-community-timeline | 200 | success | (trimmed preview) | {"cursor":{"bottom":"DAAFCgABHFJrWpS__-oLAAIAAADwRW1QQzZ3QUFBZlEvZ0dKTjB2R3AvQUFBQUJRY1VNZFFacGF4ZHh4UmxySHRXeENBSEZCVmpPZFdZZVljVUJsWVNWdXhyUnhSRVh6RG14RVRIRkM3eW5WYWtLa2NVSU1iVVpjeEdCeFFQRWxaVnZFV0hGQVg1S2pXME1VY1VZSkx... |
| GET | /fetch-popular-community | 404 | validation-error | (json parse failed) | {"error":true,"code":"error_msg","message":"strconv.ParseInt: parsing \"undefined\": invalid syntax"} |
| GET | /followers | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /followers-ids | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /following-ids | 200 | soft-error | (json parse failed) | {"request":"/1.1/friends/ids.json","error":"Not authorized."} |
| GET | /followings | 200 | soft-error | (trimmed preview) | {"cursor":{"bottom":"1854265427118546691\\|2040811641318145976","top":"-1\\|2040811641318146049"},"result":{"timeline":{"instructions":[{"type":"TimelineClearCache"},{"direction":"Top","type":"TimelineTerminateTimeline"},{"d... |
| GET | /get-users | 404 | other-error | (json parse failed) | {"error":true,"code":"err_err","message":"Cannot read properties of undefined (reading 'split')"} |
| GET | /get-users-v2 | 404 | other-error | (json parse failed) | {"error":true,"code":"error_msg","message":"No user matches for specified terms."} |
| GET | /highlights | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /job-details | 200 | success | (json parse failed) | {"result":{"viewer":{"user_results":{"id":"VXNlclJlc3VsdHM6MjIwMTY4Mzk5Nw==","result":{"__typename":"User","id":"VXNlcjoyMjAxNjgzOTk3"}}}}} |
| GET | /jobs-locations-suggest | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /jobs-search | 200 | success | (trimmed preview) | {"result":{"job_search":{"items_results":[{"id":"QXBpSm9iUmVzdWx0czoxODQ0ODgzNDYwMzQwNzExNDI2","rest_id":"1844883460340711426","result":{"__isJobResult":"ApiJob","__typename":"ApiJob","company_profile_results":{"id":"QXB... |
| GET | /likes | 200 | success | (json parse failed) | {"data":{"favoriters_timeline":{"timeline":{"instructions":[{"direction":"Bottom","type":"TimelineTerminateTimeline"}]}}}} |
| GET | /list-details | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /list-followers | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /list-members | 200 | success | (json parse failed) | {} |
| GET | /list-timeline | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /org-affiliates | 404 | validation-error | (json parse failed) | {"error":true,"code":"error_msg","message":"strconv.ParseInt: parsing \"undefined\": invalid syntax"} |
| GET | /quotes | 200 | success | (json parse failed) | {"cursor":{"bottom":"DAACCgACHFJraggAJxAKAAMcUmtqB__Y8AgABAAAAAILAAUAAAAcRW1QQzZ3QUFBZlEvZ0dKTjB2R3AvQUFBQUFBPQgABgAAAAAIAAcAAAAAAAA","top":"DAACCgACHFJraggAJxAKAAMcUmtqB__Y8AgABAAAAAELAAUAAAAcRW1QQzZ3QUFBZlEvZ0dKTjB2R3A... |
| GET | /retweets | 200 | soft-error | (json parse failed) | {"data":{},"errors":[{"message":"strconv.ParseInt: parsing \"undefined\": invalid syntax","path":["retweeters_timeline","tweet_id"]}]} |
| GET | /search | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /search-community | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /search-lists | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /search-v2 | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /search-v3 | 404 | other-error | (json parse failed) | {"error":true,"code":"err_err","message":"Cannot read properties of undefined (reading 'charAt')"} |
| GET | /spaces | 200 | soft-error | (json parse failed) | {"data":{"audioSpace":{"is_subscribed":false}},"errors":[{"code":214,"extensions":{"code":214,"kind":"Validation","name":"BadRequestError","source":"Client"},"kind":"Validation","message":"BadRequest: invalid broadcast_i... |
| GET | /trends-by-location | 200 | success | (trimmed preview) | {"result":[{"trends":[{"name":"Happy Easter","url":"http://twitter.com/search?q=%22Happy+Easter%22","promoted_content":null,"query":"%22Happy+Easter%22","tweet_volume":null},{"name":"Feliz Páscoa","url":"http://twitter.... |
| GET | /trends-locations | 200 | success | (trimmed preview) | {"result":[{"name":"Worldwide","placeType":{"code":19,"name":"Supername"},"url":"http://where.yahooapis.com/v1/place/1","parentid":0,"country":"","woeid":1,"countryCode":null},{"name":"Winnipeg","placeType":{"code":7,"na... |
| GET | /tweet | 404 | other-error | (json parse failed) | {"error":true,"code":"err_err","message":"Cannot read properties of undefined (reading 'trim')"} |
| GET | /tweet-by-ids | 404 | other-error | (json parse failed) | {"error":true,"code":"err_err","message":"Cannot read properties of undefined (reading 'split')"} |
| GET | /tweet-by-ids-v2 | 404 | other-error | (json parse failed) | {"error":true,"code":"err_err","message":"Cannot read properties of undefined (reading 'split')"} |
| GET | /tweet-v2 | 404 | validation-error | (json parse failed) | {"error":true,"code":"error_msg","message":"strconv.ParseInt: parsing \"undefined\": invalid syntax"} |
| GET | /user | 200 | success | (trimmed preview) | {"result":{"data":{"user":{"result":{"__typename":"User","affiliates_highlighted_label":{"label":{"badge":{"url":"https://pbs.twimg.com/profile_images/1976137331133308929/ey5ge0lX_bigger.jpg"},"description":"Beast Indust... |
| GET | /user-likes | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the rate limit per second for your plan, BASIC, by the API provider"} |
| GET | /user-media | 200 | success | (trimmed preview) | {"cursor":{"bottom":"DAABCgABHFJrdGb___cKAAIcTBa4HJuBEQgAAwAAAAIAAA","top":"DAABCgABHFJrdGcAJxEKAAIcUEFtchsgKggAAwAAAAEAAA"},"result":{"timeline":{"instructions":[{"type":"TimelineClearCache"},{"entries":[{"content":{"__... |
| GET | /user-replies | 200 | success | (trimmed preview) | {"cursor":{"bottom":"DAAHCgABHFJreYY__-sLAAIAAAATMjA0MDY1OTI1MDM4MTUwNDk0MggAAwAAAAIAAA","top":"DAAHCgABHFJreYZAJxELAAIAAAATMjA0MDgwNjI0OTk1NzMzOTMxMQgAAwAAAAEAAA"},"result":{"timeline":{"instructions":[{"type":"Timeline... |
| GET | /user-replies-v2 | 200 | success | (trimmed preview) | {"cursor":{"bottom":"DAAHCgABHFJrdjb__-sLAAIAAAATMjA0MDY1OTI1MDM4MTUwNDk0MggAAwAAAAIAAA","top":"DAAHCgABHFJrdjcAJxELAAIAAAATMjA0MDgwNjI0OTk1NzMzOTMxMQgAAwAAAAEAAA"},"result":{"timeline":{"instructions":[{"type":"Timeline... |
| GET | /user-tweets | 200 | success | (trimmed preview) | {"cursor":{"bottom":"DAAHCgABHFJrfJi__-sLAAIAAAATMjA0MDU0NDQxMzU0NjU5MDQ3NQgAAwAAAAIAAA","top":"DAAHCgABHFJrfJjAJxELAAIAAAATMjA0MDgwNjI0OTk1NzMzOTMxMQgAAwAAAAEAAA"},"result":{"timeline":{"instructions":[{"type":"Timeline... |
| GET | /verified-followers | 200 | success | (trimmed preview) | {"cursor":{"bottom":"1861644080037461394\\|2040811780074110954","top":"-1\\|2040811780074110977"},"result":{"timeline":{"instructions":[{"type":"TimelineClearCache"},{"direction":"Top","type":"TimelineTerminateTimeline"},{"d... |

## twitter154

| Method | Route | Status | Category | Top-level keys | Sample |
|---|---|---:|---|---|---|
| GET | /ai/named-entity-recognition | 401 | auth-error | (json parse failed) | {"message":"This endpoint is disabled for your subscription"} |
| GET | /ai/sentiment-analysis | 401 | auth-error | (json parse failed) | {"message":"This endpoint is disabled for your subscription"} |
| GET | /ai/topic-classification | 200 | success | (json parse failed) | {"detail":[{"loc":["query","text"],"msg":"field required","type":"value_error.missing"}]} |
| GET | /hashtag/hashtag | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /hashtag/hashtag | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /hashtag/hashtag/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /hashtag/hashtag/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /lists/details | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /lists/tweets | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /lists/tweets/continuation | 200 | success | (json parse failed) | {"detail":[{"loc":["query","list_id"],"msg":"field required","type":"value_error.missing"},{"loc":["query","continuation_token"],"msg":"field required","type":"value_error.missing"}]} |
| GET | /search/geo | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /search/search | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /search/search | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /search/search/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /search/search/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /translate | 401 | auth-error | (json parse failed) | {"message":"This endpoint is disabled for your subscription"} |
| POST | /translate/detect | 200 | success | (json parse failed) | {"detail":[{"loc":["body","text"],"msg":"field required","type":"value_error.missing"}]} |
| GET | /trends/ | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /trends/available | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /tweet/details | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /tweet/details | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /tweet/favoriters | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /tweet/favoriters/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /tweet/replies | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /tweet/replies | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /tweet/replies/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /tweet/replies/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /tweet/retweets | 401 | auth-error | (json parse failed) | {"message":"This endpoint is disabled for your subscription"} |
| GET | /tweet/retweets/continuation | 401 | auth-error | (json parse failed) | {"message":"This endpoint is disabled for your subscription"} |
| GET | /user/about | 200 | success | (json parse failed) | {"data":{"user_result_by_screen_name":{"id":"VXNlclJlc3VsdHM6MjQ1NTc0MDI4Mw==","result":{"__typename":"User","about_profile":{"account_based_in":"United States","affiliate_username":"Beast","learn_more_url":"https://help... |
| GET | /user/details | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/details | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/followers | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/followers | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/followers/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/followers/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/following | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/following | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/following/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/following/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/likes | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/likes | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/likes/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/likes/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/medias | 200 | success | (trimmed preview) | {"results":[{"tweet_id":"2040202569520455722","creation_date":"Fri Apr 03 22:59:32 +0000 2026","text":"Grok Imagine https://t.co/GSSjPu9S2A","media_url":["https://pbs.twimg.com/amplify_video_thumb/2040202515707461632/img... |
| POST | /user/medias | 200 | success | (trimmed preview) | {"results":[{"tweet_id":"2040202569520455722","creation_date":"Fri Apr 03 22:59:32 +0000 2026","text":"Grok Imagine https://t.co/GSSjPu9S2A","media_url":["https://pbs.twimg.com/amplify_video_thumb/2040202515707461632/img... |
| GET | /user/medias/continuation | 200 | success | (trimmed preview) | {"results":[{"tweet_id":"2040202569520455722","creation_date":"Fri Apr 03 22:59:32 +0000 2026","text":"Grok Imagine https://t.co/GSSjPu9S2A","media_url":["https://pbs.twimg.com/amplify_video_thumb/2040202515707461632/img... |
| POST | /user/medias/continuation | 200 | success | (json parse failed) | {"detail":[{"loc":["body","continuation_token"],"msg":"field required","type":"value_error.missing"}]} |
| GET | /user/tweets | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/tweets | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| GET | /user/tweets/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |
| POST | /user/tweets/continuation | 429 | plan-or-rate-limit | (json parse failed) | {"message":"You have exceeded the MONTHLY quota for Requests on your current plan, BASIC. Upgrade your plan at https://rapidapi.com/datahungrybeast/api/twitter154"} |


