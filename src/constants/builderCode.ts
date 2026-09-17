import { Attribution } from 'ox/erc8021';

const BUILDER_CODE_ENV = import.meta.env.VITE_BASE_BUILDER_CODE?.trim();

export const BUILDER_CODE = BUILDER_CODE_ENV && BUILDER_CODE_ENV.length > 0 ? BUILDER_CODE_ENV : null;

export function getBuilderCodeDataSuffix(): `0x${string}` | undefined {
  if (!BUILDER_CODE) return undefined;
  try {
    return Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
  } catch {
    console.warn('[Builder Code] Invalid VITE_BASE_BUILDER_CODE. Skipping attribution suffix.');
    return undefined;
  }
}
