import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPolicyDriveFiles } from '../../../api/drive';
import type { DriveFile, Policy } from '../../../types';

export type PolicyDocumentsState =
  | { status: 'idle'; files: DriveFile[] }
  | { status: 'loading'; files: DriveFile[] }
  | { status: 'ready'; files: DriveFile[] }
  | { status: 'error'; files: DriveFile[] };

type PolicyDocumentsById = Record<string, PolicyDocumentsState>;

const IDLE_DOCUMENTS: PolicyDocumentsState = { status: 'idle', files: [] };
const EMPTY_DOCUMENTS: PolicyDocumentsState = { status: 'ready', files: [] };

export const usePolicyDocuments = () => {
  const [documentsByPolicyId, setDocumentsByPolicyId] = useState<PolicyDocumentsById>({});
  const requestedPolicyIdsRef = useRef(new Set<string>());
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPolicyDocuments = useCallback(async (policy: Policy) => {
    if (!policy.driveFolderId || requestedPolicyIdsRef.current.has(policy.id)) {
      return;
    }
    requestedPolicyIdsRef.current.add(policy.id);
    setDocumentsByPolicyId((current) => ({
      ...current,
      [policy.id]: { status: 'loading', files: [] },
    }));

    try {
      const response = await fetchPolicyDriveFiles(policy.id);
      if (isMountedRef.current) {
        setDocumentsByPolicyId((current) => ({
          ...current,
          [policy.id]: { status: 'ready', files: response.files },
        }));
      }
    } catch {
      requestedPolicyIdsRef.current.delete(policy.id);
      if (isMountedRef.current) {
        setDocumentsByPolicyId((current) => ({
          ...current,
          [policy.id]: { status: 'error', files: [] },
        }));
      }
    }
  }, []);

  return { documentsByPolicyId, loadPolicyDocuments };
};

export const getPolicyDocumentsState = (
  policy: Policy,
  documentsByPolicyId: PolicyDocumentsById,
): PolicyDocumentsState =>
  documentsByPolicyId[policy.id] ?? (policy.driveFolderId ? IDLE_DOCUMENTS : EMPTY_DOCUMENTS);
