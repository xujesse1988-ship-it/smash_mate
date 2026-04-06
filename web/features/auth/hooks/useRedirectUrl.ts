import { useSearchParams } from 'react-router-dom';

const DEFAULT_REDIRECT = '/activities';

export function useRedirectUrl(): string {
  const [searchParams] = useSearchParams();
  return searchParams.get('redirect') || DEFAULT_REDIRECT;
}
