import type { ClassificationContext, LeadClassification } from "./types.js";

export interface LeadClassifier {
  classify(context: ClassificationContext): Promise<LeadClassification>;
}
