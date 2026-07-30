import { useEffect, useRef, useState } from "react";

const bookmarkSearchDebounceMilliseconds = 250;

function useDebouncedBookmarkSearchText(
  searchText: string,
  resetKey?: string | null,
): string {
  const [debouncedSearchText, setDebouncedSearchText] = useState(
    searchText.trim(),
  );
  const resetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      setDebouncedSearchText("");
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, bookmarkSearchDebounceMilliseconds);

    return () => window.clearTimeout(timeout);
  }, [resetKey, searchText]);

  return debouncedSearchText;
}

export { useDebouncedBookmarkSearchText };
