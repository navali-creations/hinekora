import { useNavigate } from "@tanstack/react-router";
import { FiArrowLeft as ArrowLeft } from "react-icons/fi";

type PageBackFallbackRoute = "/clips" | "/recordings";

interface PageBackButtonProps {
  fallbackTo: PageBackFallbackRoute;
}

function PageBackButton({ fallbackTo }: PageBackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (globalThis.history.length > 1) {
      globalThis.history.back();
      return;
    }

    void navigate({ to: fallbackTo });
  };

  return (
    <button
      aria-label="Go back"
      className="btn btn-ghost btn-sm btn-square no-drag"
      title="Back"
      type="button"
      onClick={handleBack}
    >
      <ArrowLeft size={16} />
    </button>
  );
}

export { PageBackButton };
