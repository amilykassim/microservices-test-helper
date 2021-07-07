import { EventInfo } from "./event-info.dto";
import { TelcoPaymentRequest } from "./telco-payment-request.dto";
import { VodacomPaymentResponse } from "./vodacom-payment-response.dto";

export class TelcoPaymentResponse {
    eventInfo: EventInfo;
    request: TelcoPaymentRequest;
    response: VodacomPaymentResponse;
}