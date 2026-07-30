import clsx from "clsx";
import type { ChangeEvent } from "react";
import { FiSearch, FiX } from "react-icons/fi";

interface BookmarksSearchInputProps {
  className?: string;
  searchText: string;
  size?: "sm" | "xs";
  onSearchTextChange: (searchText: string) => void;
}

function BookmarksSearchInput({
  className = "",
  searchText,
  size = "sm",
  onSearchTextChange,
}: BookmarksSearchInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchTextChange(event.currentTarget.value.slice(0, 120));
  };

  const handleClear = () => {
    onSearchTextChange("");
  };

  return (
    <label
      className={clsx(
        "input input-bordered flex min-w-0 items-center",
        {
          "input-sm h-8 gap-2": size === "sm",
          "input-xs h-7 gap-1.5 text-xs": size === "xs",
        },
        className,
      )}
    >
      <FiSearch
        className="shrink-0 text-base-content/45"
        size={size === "xs" ? 13 : 14}
      />
      <input
        aria-label="Search bookmark zones"
        className="min-w-0 grow"
        maxLength={120}
        placeholder="Search zones"
        type="search"
        value={searchText}
        onChange={handleChange}
      />
      {searchText.length > 0 && (
        <button
          aria-label="Clear bookmark zone search"
          className={clsx("btn btn-ghost btn-xs btn-circle -mr-1", {
            "size-5 min-h-5": size === "xs",
          })}
          type="button"
          onClick={handleClear}
        >
          <FiX size={13} />
        </button>
      )}
    </label>
  );
}

export { BookmarksSearchInput };
