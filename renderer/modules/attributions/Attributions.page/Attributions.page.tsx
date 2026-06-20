import { FiExternalLink } from "react-icons/fi";

import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";

const ATTRIBUTIONS = [
  {
    name: "noobs",
    description: "OBS integration used for Rewind and recording control.",
    url: "https://github.com/navali-creations/noobs",
  },
  {
    name: "Path of Exile",
    description:
      "Game title and related terms are property of Grinding Gear Games.",
    url: "https://www.pathofexile.com/",
  },
] as const;

function AttributionsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Attributions"
        subtitle="Credit to the third-party projects and services used by Hinekora."
      />
      <PageContent>
        <div className="px-2 pb-8">
          <div className="flex max-w-2xl flex-col gap-4">
            {ATTRIBUTIONS.map((attribution) => (
              <a
                key={attribution.name}
                href={attribution.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card cursor-pointer border border-transparent bg-base-200 no-underline transition-colors hover:border-info"
              >
                <div className="card-body p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="card-title text-base text-base-content">
                      {attribution.name}
                    </h3>
                    <FiExternalLink
                      size={14}
                      className="shrink-0 text-base-content/50"
                    />
                  </div>
                  <p className="m-0 text-base-content/70 text-sm">
                    {attribution.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
}

export { AttributionsPage };
