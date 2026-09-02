import { useQuery } from "@tanstack/react-query";

import {
  fetchAgreements,
  fetchJobDraft,
  fetchJobResult,
  fetchJobs,
  fetchRateBundle,
  fetchRateItems,
  fetchRateTables,
} from "./db";

export const useAgreements = () => useQuery({ queryKey: ["agreements"], queryFn: fetchAgreements });

export const useRateTables = () =>
  useQuery({ queryKey: ["rate_tables"], queryFn: fetchRateTables });

export const useRateBundle = (rateTableId: string | null) =>
  useQuery({
    queryKey: ["rate_bundle", rateTableId],
    queryFn: () => fetchRateBundle(rateTableId),
    enabled: rateTableId !== null,
  });

export const useRateItems = (rateTableId: string | null) =>
  useQuery({
    queryKey: ["rate_items", rateTableId],
    queryFn: () => fetchRateItems(rateTableId!),
    enabled: rateTableId !== null,
  });

export const useJobs = () => useQuery({ queryKey: ["jobs"], queryFn: fetchJobs });

export const useJobDraft = (jobId: string | null) =>
  useQuery({
    queryKey: ["job_draft", jobId],
    queryFn: () => fetchJobDraft(jobId!),
    enabled: jobId !== null,
  });

export const useJobResult = (jobId: string | null) =>
  useQuery({
    queryKey: ["job_result", jobId],
    queryFn: () => fetchJobResult(jobId!),
    enabled: jobId !== null,
  });
