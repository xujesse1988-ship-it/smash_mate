import { useNavigate } from 'react-router-dom';

/**
 * Hook for navigating to the target page based on notification targetType.
 * Route mapping per web-app-notification.md §6.1:
 *   - activity → /activities/:targetId
 *   - group-class → /group-classes/:targetId
 *   - private-lesson → /my-courses (no targetId in route)
 *   - coach-profile → /coaches/:targetId
 */
export function useNotificationNavigate() {
  const navigate = useNavigate();

  function navigateToTarget(targetType: string, targetId: string) {
    switch (targetType) {
      case 'activity':
        navigate(`/activities/${targetId}`);
        break;
      case 'group-class':
        navigate(`/group-classes/${targetId}`);
        break;
      case 'private-lesson':
        navigate('/my-courses');
        break;
      case 'coach-profile':
        navigate(`/coaches/${targetId}`);
        break;
      default:
        break;
    }
  }

  return { navigateToTarget };
}
