import { type } from "arktype";
import { clean } from "semver";

const envVar = type({
  GITHUB_DOWNLOAD_URL: "string.url",
  GITHUB_REF_NAME: type("string").pipe((ref) => clean(ref)),
});

/**
 * Validates a set of environment variables at build time, such as the enpoint URL for GitHub release artifacts.
 * Better than define since the build fails if the environment variable is not set.
 *
 * @returns An object containing the build time constants.
 */
export function environmentVariables() {
  try {
    const { GITHUB_DOWNLOAD_URL, GITHUB_REF_NAME } = envVar.assert({
      GITHUB_DOWNLOAD_URL: process.env.GITHUB_DOWNLOAD_URL,
      GITHUB_REF_NAME: process.env.GITHUB_REF_NAME,
    });
    return { GITHUB_DOWNLOAD_URL, GITHUB_REF_NAME };
  } catch (error) {
    console.error(`Failed to get environment variables:`, { error });
    throw error;
  }
}
