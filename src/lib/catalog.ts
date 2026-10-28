export type CatalogItem = {
  id: string;
  title?: string;
  url: string;
  category?: string;
  score?: number;
  summary?: string;
  topics?: string[];
  screenshotPath?: string;
  screenshotThumbnailPath?: string;
  screenshotUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  createdAt?: string;
};

export type AnalysisResult = Partial<CatalogItem> & {
  siteTitle?: string;
  status?: string;
  contentState?: string;
  contentStateReason?: string;
  intent?: string;
  relevance?: number;
  clarity?: number;
  practicalValue?: number;
  noiseLevel?: number;
  strengths?: string[];
  weaknesses?: string[];
  improvements?: string[];
  lastAnalyzedAt?: string;
  alreadyApproved?: boolean;
  alreadyPending?: boolean;
};

export function siteHost(url?: string) {
  try {
    return new URL(url ?? "").hostname.replace(/^www\./, "");
  } catch {
    return url ?? "";
  }
}

// Public catalog media must be HTTP(S); never render data/blob/javascript URLs from stored content.
export function imageSource(
  item: CatalogItem,
  apiBase = "",
  publicAssetBase = "",
) {
  const ref =
    item.imageUrl ||
    item.thumbnailUrl ||
    item.screenshotThumbnailPath ||
    item.screenshotUrl ||
    item.screenshotPath ||
    "";
  if (/^https?:\/\//i.test(ref)) return ref;
  if (/^\/?screenshots\//.test(ref))
    return `${publicAssetBase}/${ref.replace(/^\//, "")}`;
  if (/^\/?storage\//.test(ref)) return `${apiBase}/${ref.replace(/^\//, "")}`;
  return "";
}

export function publicUrl(value?: string) {
  try {
    const url = new URL(value ?? "");
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
