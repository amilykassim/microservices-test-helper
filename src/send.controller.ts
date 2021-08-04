import { Body, Controller, Post, Res, Req } from '@nestjs/common';
import { KafkaHelper } from './utils/kafka-helper';
import axios from 'axios';
const qs = require('qs');
require('dotenv').config();

@Controller()
export class SendController {

	constructor(
		private readonly kafkaHelper: KafkaHelper,
	) { }

	@Post('/sendRequest')
	async setSubscriptionPayment(@Req() request: any, @Res() res) {
		// Set the type and the merchantId to the wallet payload
		const allocateSMSRequest = {
			"merchantId": "7117b4f0-cc3b-4ee4-955c-bb436a1498de",
			"amount": 12,
			"description": "SMS Allocation",
			"transactionId": "7af0ca42-ff83-4815-bec9-065e4f22840b"
		};

		this.kafkaHelper.send(request.body, 'sms allocation', process.env.WALLET_SMS_ALLOCATE_REQUEST_TOPIC);

		return res.send('received')

		// return res.status(200).json(request)
	}

	@Post('/vodacom/login')
	async vodacomLogin(@Body() request: any, @Res() res) {
		return res.status(200).send(this.getLoginResponsePayload());
	}

	@Post('/vodacom/pay')
	async vodacomPay(@Body() request: any, @Res() res) {
		return res.status(200).send(this.getInitiatePaymentPayload());
	}

	@Post('/payments/callback')
	async paymentCallback(@Body() request: any, @Res() res) {
		const callbackRequest = this.getCallbackresponse();
		console.log('>>> the call back request is : ', callbackRequest);
		const data = await this.sendRequest(process.env.AGENT_CALLBACK_URL, this.getCallbackresponse());

		return res.status(200).send(this.getInitiatePaymentPayload());
	}

	async sendRequest(url: string, request: string) {
		try {
      let { data } = await axios.post(url, qs.stringify(request),
        { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
      );

      return data;
    } catch (error) {
      console.log('>>>>error while calling backend is : ', error);
      return null;
    }
	}


	getLoginResponsePayload() {
		return `<?xml version='1.0' encoding='UTF-8'?>
<S:Envelope
xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
<S:Header>
<ns3:eventid
xmlns:ns2="http://www.4cgroup.co.za/genericsoap"
xmlns:ns3="http://www.4cgroup.co.za/soapauth">2500
</ns3:eventid>
</S:Header>
<S:Body>
<ns2:getGenericResultResponse
xmlns:ns2="http://www.4cgroup.co.za/genericsoap"
xmlns:ns3="http://www.4cgroup.co.za/soapauth">
<SOAPAPIResult>
<eventInfo>
<code>3</code>
<description>Processed</description>
<detail>Processed</detail>
<transactionID>0c49ec4bbebe44b082aa24e5f548b514</transactionID>
</eventInfo>
<request>
<dataItem>
<name>Username</name>
<type>String</type>
<value>thirdpartyc2bw</value>
</dataItem>
<dataItem>
<name>Password</name>
<type>String</type>
<value>thirdpartyc2bw</value>
</dataItem>
</request>
<response>
<dataItem>
<name>SessionID</name>
<type>String</type>
<value>dbcb63a40afd4191a990d66ed9cb62f7</value>
</dataItem>
</response>
</SOAPAPIResult>
</ns2:getGenericResultResponse>
</S:Body>
</S:Envelope>`;
	}

	getInitiatePaymentPayload() {
		return `<?xml version='1.0' encoding='UTF-8'?>
		<S:Envelope
		xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"
		xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
		<S:Header>
		<ns3:eventid
		xmlns:ns2="http://www.4cgroup.co.za/genericsoap"
		xmlns:ns3="http://www.4cgroup.co.za/soapauth">80049
		</ns3:eventid>
		</S:Header>
		<S:Body>
		<ns2:getGenericResultResponse
		xmlns:ns2="http://www.4cgroup.co.za/genericsoap"
		xmlns:ns3="http://www.4cgroup.co.za/soapauth">
		<SOAPAPIResult>
		<eventInfo>
		<code>3</code>
		<description>Processed</description>
		<detail>Processed</detail>
		<transactionID>80db41ffab3c4b88ab7f937f9fd7ccc9</transactionID>
		</eventInfo>
		<request>
		<dataItem>
		<name>CustomerMSISDN</name>
		<type>String</type>
		<value>243811835361</value>
		</dataItem>
		<dataItem>
		<name>ServiceProviderCode</name>
		<type>String</type>
		<value>8337</value>
		</dataItem>
		<dataItem>
		<name>Currency</name>
		<type>String</type>
		<value>CDF</value>
		</dataItem>
		<dataItem>
		<name>Amount</name>
		<type>String</type>
		<value>10</value>
		</dataItem>
		<dataItem>
		<name>Date</name>
		<type>String</type>
		<value>20170901155250</value>
		</dataItem>
		<dataItem>
<name>ThirdPartyReference</name>
<type>String</type>
<value>Test100</value>
</dataItem>
<dataItem>
<name>CommandId</name>
<type>String</type>
<value>InitTrans_oneForallC2B</value>
</dataItem>
<dataItem>
<name>Language</name>
<type>String</type>
<value>EN</value>
</dataItem>
<dataItem>
<name>CallBackChannel</name>
<type>String</type>
<value>4</value>
</dataItem>
<dataItem>
<name>CallBackDestination</name>
<type>String</type>
<value>Christian.Belewete@vodacom.cd</value>
</dataItem>
<dataItem>
<name>Surname</name>
<type>String</type>
<value>Surname</value>
</dataItem>
<dataItem>
<name>Initials</name>
<type>String</type>
<value>Initials</value>
</dataItem>
</request>
<response>
<dataItem>
<name>InsightReference</name>
<type>String</type>
<value>7272C194D0B50616E054002128FBA42E</value>
</dataItem>
<dataItem>
<name>ResponseCode</name>
<type>String</type>
<value>0</value>
</dataItem>
<dataItem>
<name>CustomerMSISDN</name>
<type>String</type>
<value>243811835361</value>
</dataItem>
</response>
</SOAPAPIResult>
</ns2:getGenericResultResponse>
</S:Body>
</S:Envelope>`;
	}

	getCallbackresponse() {
		return `<soapenv:Envelope
		xmlns:soapenv='http://schemas.xmlsoap.org/soap/envelope/'
		xmlns:soap='http://www.4cgroup.co.za/soapauth'
		xmlns:gen='http://www.4cgroup.co.za/genericsoap'>
				<soapenv:Body>
						<gen:getGenericResult>
								<Request>
										<dataItem>
												<name>ResultType</name>
												<value>0</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>ResultCode</name>
												<value>0</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>ResultDesc</name>
												<value>Process service request successfully.</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>OriginatorConversationID</name>
												<value>9f76049816424eb293e24f67b6146622</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>ConversationID</name>
												<value>AG_20180802_00007447cd58aee5d918</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>ThirdPartyReference</name>
												<value>Test100</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>Amount</name>
												<value>10</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>TransactionTime</name>
												<value>-1</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>InsightReference</name>
												<value>727668AD2A2C389EE054002128FBA42E</value>
												<type>String</type>
										</dataItem>
										<dataItem>
												<name>TransactionID</name>
												<value>5H275YKJEP</value>
												<type>String</type>
										</dataItem>
								</Request>
						</gen:getGenericResult>
				</soapenv:Body>
		</soapenv:Envelope>`;
	}
}
