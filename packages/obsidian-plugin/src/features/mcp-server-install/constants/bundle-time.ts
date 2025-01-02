import { type } from "arktype";

const envVar = type({
  GITHUB_DOWNLOAD_URL: "string.url",
  GITHUB_REF_NAME: "string.semver",
});

/**
 * Validates a set of environment variables at build time, such as the enpoint URL for GitHub release artifacts.
 * Better than define since the build fails if the environment variable is not set.
 *
 * @returns An object containing the build time constants.
 */
export function environmentVariables() {
  const { GITHUB_DOWNLOAD_URL, GITHUB_REF_NAME } = envVar.assert(process.env);
  return { GITHUB_DOWNLOAD_URL, GITHUB_REF_NAME };
}
