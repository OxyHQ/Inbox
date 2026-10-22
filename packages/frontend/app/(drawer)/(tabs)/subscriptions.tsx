import { PrivateInboxContent } from '@/components/PrivateInboxContent';
import { SubscriptionsScreen } from '@/components/SubscriptionsScreen';

function SubscriptionsRouteContent() {
  return <SubscriptionsScreen />;
}

export default function SubscriptionsRoute() {
  return (
    <PrivateInboxContent>
      <SubscriptionsRouteContent />
    </PrivateInboxContent>
  );
}
