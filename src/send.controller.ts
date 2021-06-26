import { Body, Controller, Post, Res } from '@nestjs/common';
import { KafkaHelper } from './utils/kafka-helper';
require('dotenv').config();

@Controller()
export class SendController {

	constructor(
		private readonly kafkaHelper: KafkaHelper,
	) { }

	@Post('/send')
	async setSubscriptionPayment(@Body() request: any, @Res() res) {
		// Set the type and the merchantId to the wallet payload
		this.kafkaHelper.send(request, 'subscription', process.env.PGW_SEND_SMS_REQUEST_TOPIC);

		return res.status(200).json(request)
	}
}
