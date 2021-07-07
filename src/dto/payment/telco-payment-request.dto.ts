export class TelcoPaymentRequest {
  serviceProviderCode: string;
  customerMSISDN: string;
  currency: string;
  amount: string;
  date: string;
  thirdPartyReference: string;
  commandId: string;
  language: string;
  callbackChannel: string;
  callbackDestination: string;
  surname: string;
  initials: string;
}
