/**
 * Site structure, shared by the header and the footer.
 *
 * Kept in a plain module rather than inside the header component. The header is
 * a client component and the footer is a server component, and importing a
 * constant across that boundary fails at prerender time with a confusing
 * "TOOLS.map is not a function", because what crosses the boundary is a
 * reference to a client module rather than the array itself.
 */

export const TOOLS: [string, string, string][] = [
  ["/try", "Stage a scan", "Run the model on a brain and see where it looked"],
  ["/explore", "Brain explorer", "Cut through a real scan in three directions"],
  ["/ventricles", "Ventricle lab", "Measure the fluid spaces yourself"],
  ["/patients", "Patient browser", "Every held-out patient and what the model said"],
  ["/split", "Split simulator", "Watch a bad split invent accuracy"],
  ["/check", "Check your data", "Find this mistake in your own dataset"],
];

export const READ: [string, string, string][] = [
  ["/findings", "Findings", "The three things this project actually showed"],
  ["/results", "Results", "Every number, and where they fall apart"],
  ["/data", "The data", "347 people, and why that is the whole story"],
  ["/method", "Method", "How it was built and what went wrong"],
  ["/references", "References", "Real papers, looked up not remembered"],
];

export const LEGAL: [string, string][] = [
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/cookies", "Cookies"],
  ["/accessibility", "Accessibility"],
];
