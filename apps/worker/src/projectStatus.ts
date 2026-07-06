export type CompletedProjectStatus = "COMPLETED" | "FAILED";

export function projectStatusAfterGeneration(status: "SUCCEEDED" | "FAILED"): CompletedProjectStatus {
  return status === "SUCCEEDED" ? "COMPLETED" : "FAILED";
}
