const github = require("@changesets/changelog-github").default;

/** @type {import("@changesets/types").ChangelogFunctions} */
const changelogFunctions = {
  ...github,
  async getReleaseLine(changeset, type, options) {
    const original = await github.getReleaseLine(changeset, type, options);

    // The upstream format is:
    //   - [`commit`](url) Thanks [@user](url)! - summary content
    //
    // Replace the inline ` - ` separator after `!` with a newline so
    // the summary always starts on its own indented line.
    return original.replace(/(!)\s-\s/, "$1\n\n  ");
  },
};

module.exports = changelogFunctions;
