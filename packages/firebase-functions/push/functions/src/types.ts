interface IResponse {
  code: number;
  success: boolean;
  errorMessage?: string;
  data?: any;
}

interface IRegistrationOptions {
  bridge: string;
  topic: string;
  type: 'fcm';
  token: string;
  peerName: string;
  language: string;
}

interface IRegistration extends IRegistrationOptions {
  lastMessageTimestamp: number;
}

export { IResponse, IRegistrationOptions, IRegistration };
