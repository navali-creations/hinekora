import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { FiGitCommit, FiShield, FiUser } from "react-icons/fi";
import { MdOutlineNewReleases } from "react-icons/md";
import type { Components } from "react-markdown";

import { Badge } from "~/renderer/components/Badge/Badge";
import { MarkdownRenderer } from "~/renderer/components/MarkdownRenderer/MarkdownRenderer";
import { Modal, type ModalHandle } from "~/renderer/components/Modal/Modal";
import { CORE_MAINTAINERS } from "~/renderer/modules/changelog/Changelog.utils/Changelog.utils";
import { useAppMenu } from "~/renderer/store";

import { WhatsNewReleaseTabs } from "./WhatsNewReleaseTabs/WhatsNewReleaseTabs";

const COMMIT_URL_PATTERN = /\/commit\//;
const GITHUB_USER_PATTERN = /^@/;

function getPlainText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getPlainText).join("");
  }

  return "";
}

function formatReleaseDate(publishedAt: string | null | undefined): string {
  if (!publishedAt) {
    return "";
  }

  return new Date(publishedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const whatsNewComponents: Partial<Components> = {
  a: ({ children, href, ...props }) => {
    const text = getPlainText(children);

    if (href && COMMIT_URL_PATTERN.test(href)) {
      return (
        <Badge variant="info" size="sm" soft icon={<FiGitCommit size={11} />}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            {...props}
          >
            {children}
          </a>
        </Badge>
      );
    }

    if (text && GITHUB_USER_PATTERN.test(text)) {
      const username = text.slice(1);
      const isMaintainer = CORE_MAINTAINERS.has(username);
      return (
        <Badge
          variant={isMaintainer ? "success" : "info"}
          size="sm"
          soft
          icon={isMaintainer ? <FiShield size={11} /> : <FiUser size={11} />}
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            {...props}
          >
            {children}
          </a>
          {isMaintainer && (
            <span className="opacity-60"> - core maintainer</span>
          )}
        </Badge>
      );
    }

    return (
      <a
        className="text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        href={href}
        {...props}
      >
        {children}
      </a>
    );
  },
};

const WhatsNewModal = () => {
  const {
    isWhatsNewOpen,
    whatsNewRelease,
    whatsNewIsLoading,
    whatsNewError,
    closeWhatsNew,
  } = useAppMenu();

  const modalRef = useRef<ModalHandle>(null);

  // Sync zustand state with the native <dialog> element
  useEffect(() => {
    if (isWhatsNewOpen) {
      modalRef.current?.open();
    } else {
      modalRef.current?.close();
    }
  }, [isWhatsNewOpen]);

  return (
    <Modal
      ref={modalRef}
      size="lg"
      className="flex h-[628px] max-h-[calc(100vh-4rem)] flex-col"
      onClose={closeWhatsNew}
    >
      <div className="mb-4">
        <div className="flex min-w-0 items-center gap-3">
          <MdOutlineNewReleases className="h-6 w-6 shrink-0 text-primary" />
          <h3 className="shrink-0 font-bold text-lg">Hinekora</h3>
          <WhatsNewReleaseTabs />
        </div>
        {whatsNewRelease?.publishedAt && (
          <div className="mt-2 pl-9 text-xs text-base-content/50">
            Released {formatReleaseDate(whatsNewRelease.publishedAt)}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
        {whatsNewIsLoading && (
          <div className="flex min-h-full items-center justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {whatsNewError && !whatsNewIsLoading && (
          <div className="alert alert-error text-sm">
            <span>{whatsNewError}</span>
          </div>
        )}

        {whatsNewRelease &&
          !whatsNewIsLoading &&
          (whatsNewRelease.body ? (
            <MarkdownRenderer componentOverrides={whatsNewComponents}>
              {whatsNewRelease.body}
            </MarkdownRenderer>
          ) : (
            <p className="text-sm text-base-content/60">
              No detailed changes available for this release.
            </p>
          ))}
      </div>

      <div className="modal-action">
        <button
          className="btn btn-sm btn-primary"
          type="button"
          onClick={closeWhatsNew}
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default WhatsNewModal;
