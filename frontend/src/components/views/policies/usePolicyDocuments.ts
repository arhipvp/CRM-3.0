import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPolicyDriveFiles } from '../../../api/drive';
import type { DriveFile, Policy } from '../../../types';

const MAX_CONCURRENT_REQUESTS = 4;

export type PolicyDocumentsState =
  | { status: 'loading'; files: DriveFile[] }
  | { status: 'ready'; files: DriveFile[] }
  | { status: 'error'; files: DriveFile[] };

type PolicyDocumentsById = Record<string, PolicyDocumentsState>;

const EMPTY_DOCUMENTS: PolicyDocumentsState = { status: 'ready', files: [] };

export const usePolicyDocuments = (policies: Policy[]): PolicyDocumentsById => {
  const [documentsByPolicyId, setDocumentsByPolicyId] = useState<PolicyDocumentsById>({});
  const requestedPolicyIdsRef = useRef(new Set<string>());
  const isMountedRef = useRef(false);

  const policiesWithFolders = useMemo(() => {
    const seenIds = new Set<string>();
    return policies.filter((policy) => {
      if (!policy.driveFolderId || seenIds.has(policy.id)) {
        return false;
      }
      seenIds.add(policy.id);
      return true;
    });
  }, [policies]);

  const policyIdsKey = policiesWithFolders.map((policy) => policy.id).join('|');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const pendingPolicies = policiesWithFolders.filter((policy) => {
      if (requestedPolicyIdsRef.current.has(policy.id)) {
        return false;
      }
      requestedPolicyIdsRef.current.add(policy.id);
      return true;
    });

    if (pendingPolicies.length === 0) {
      return;
    }

    setDocumentsByPolicyId((current) => {
      const next = { ...current };
      pendingPolicies.forEach((policy) => {
        next[policy.id] = { status: 'loading', files: [] };
      });
      return next;
    });

    let nextPolicyIndex = 0;
    const loadNext = async (): Promise<void> => {
      const policy = pendingPolicies[nextPolicyIndex++];
      if (!policy) {
        return;
      }

      try {
        const response = await fetchPolicyDriveFiles(policy.id);
        if (isMountedRef.current) {
          setDocumentsByPolicyId((current) => ({
            ...current,
            [policy.id]: { status: 'ready', files: response.files },
          }));
        }
      } catch {
        if (isMountedRef.current) {
          setDocumentsByPolicyId((current) => ({
            ...current,
            [policy.id]: { status: 'error', files: [] },
          }));
        }
      }

      await loadNext();
    };

    void Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, pendingPolicies.length) }, () =>
        loadNext(),
      ),
    );
  }, [policiesWithFolders, policyIdsKey]);

  return documentsByPolicyId;
};

export const getPolicyDocumentsState = (
  policy: Policy,
  documentsByPolicyId: PolicyDocumentsById,
): PolicyDocumentsState => documentsByPolicyId[policy.id] ?? EMPTY_DOCUMENTS;
