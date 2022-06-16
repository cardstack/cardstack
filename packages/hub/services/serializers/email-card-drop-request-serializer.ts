import { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { JSONAPIDocument } from '../../utils/jsonapi-document';

interface EmailCardDropRequestClaimStatus {
  ownerAddress: string;
  available: boolean;
  claimed: boolean;
  rateLimited: boolean;
  timestamp: Date;
}

export default class EmailCardDropRequestSerializer {
  serialize(model: EmailCardDropRequest): JSONAPIDocument {
    return {
      data: {
        type: 'email-card-drop-requests',
        id: model.id,
        attributes: {
          'owner-address': model.ownerAddress,
        },
      },
    };
  }

  serializeEmailCardDropRequestStatus(model: EmailCardDropRequestClaimStatus): JSONAPIDocument {
    return {
      data: {
        type: 'email-card-drop-request-claim-status',
        id: `${model.ownerAddress}-${model.timestamp.toISOString()}`,
        attributes: {
          'owner-address': model.ownerAddress,
          available: model.available,
          claimed: model.claimed,
          'rate-limited': model.rateLimited,
          timestamp: model.timestamp.toISOString(),
        },
      },
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'email-card-drop-request-serializer': EmailCardDropRequestSerializer;
  }
}
