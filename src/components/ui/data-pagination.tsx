"use client";

import { Button } from "@/components/ui/button";

export function DataPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const displayTotalPages = totalPages === 0 ? 1 : totalPages;
  const displayPage = Math.min(Math.max(1, page), displayTotalPages);

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 text-sm text-muted-foreground">
        Page {displayPage} of {displayTotalPages}
      </div>

      <div className="flex items-center justify-end gap-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          disabled={displayPage === 1}
          onClick={() => onPageChange(Math.max(1, displayPage - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={totalPages === 0 || displayPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, displayPage + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
