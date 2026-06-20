import { FiBarChart2, FiExternalLink, FiShield } from "react-icons/fi";

const PRIVACY_POLICY_URL =
  "https://github.com/navali-creations/Hinekora/blob/master/PRIVACY.md";

function AppSetupTelemetryStep() {
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-base-content">
        Privacy & Telemetry
      </h2>
      <p className="mb-4 text-sm text-base-content/60">
        Hinekora collects anonymous data to help us improve the app. Here's what
        we use and why:
      </p>

      <div className="space-y-3">
        <div className="rounded-lg border border-base-content/10 bg-base-100 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-primary">
              <FiShield className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base-content">
                Crash Reporting
                <span className="badge badge-ghost badge-sm ml-2 font-normal">
                  Sentry
                </span>
              </h3>
              <p className="mt-1 text-xs text-base-content/60">
                When something goes wrong, an anonymous error report is sent so
                we can find and fix bugs quickly. This includes the error type,
                your OS, and app version.
              </p>
              <p className="mt-1.5 text-xs italic text-base-content/50">
                Usernames and local file paths are redacted where possible.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-base-content/10 bg-base-100 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-primary">
              <FiBarChart2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base-content">
                Usage Analytics
                <span className="badge badge-ghost badge-sm ml-2 font-normal">
                  Umami
                </span>
              </h3>
              <p className="mt-1 text-xs text-base-content/60">
                Anonymous page views and feature usage help us understand which
                parts of the app matter most, so we can focus our efforts where
                they count.
              </p>
              <p className="mt-1.5 text-xs italic text-base-content/50">
                No personal data is collected. We see aggregated counts, not
                individual activity.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-base-content/50">
        Both are enabled by default. You can opt out of either at any time in{" "}
        <span className="font-semibold text-base-content/70">
          Settings - Privacy & Telemetry
        </span>
        .
      </p>
      <p className="mt-2 text-xs text-base-content/50">
        By continuing, you agree to our{" "}
        <a
          className="link link-primary inline-flex items-center gap-0.5"
          href={PRIVACY_POLICY_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Privacy Policy
          <FiExternalLink className="h-3 w-3" />
        </a>
        .
      </p>
    </div>
  );
}

export default AppSetupTelemetryStep;
