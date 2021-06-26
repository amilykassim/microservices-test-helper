import { Body, Controller, Post, Res } from '@nestjs/common';
import { Client, MessagePattern, Payload } from '@nestjs/microservices/decorators';
import { ClientKafka, Transport } from '@nestjs/microservices';
import { KafkaHelper } from './utils/kafka-helper';
import { GatewayModel } from './dto/gateway.dto';
require('dotenv').config(); // setup the necessary kafka configs

@Controller('/api/v1')
export class AppController {
  @Client({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER_URL],
      },
      consumer: {
        groupId: process.env.API_HELPER_GROUP_ID,
      },
    },
  })
  private readonly client: ClientKafka;

  async onModuleInit() {
    console.log('>>> initated the app')
    await this.client.connect();
  }
  constructor(
    private readonly kafkaHelper: KafkaHelper,
  ) { }

  @MessagePattern(process.env.BILLING_SUBSCRIPTION_REQUEST_TOPIC)
  async setSubscriptionPayment(@Payload() data) {
    console.log('\n\n\n\n Returning a response.....');

    const response = { "msg": "description" };

    this.kafkaHelper.send(response, 'subscription', process.env.BILLING_SUBSCRIPTION_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.merchantId, message: '[billing microservice] The subscription payment is set successfully' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern(process.env.WALLET_CREATE_REQUEST_TOPIC)
  async createWallet(@Payload() data) {
    console.log('>>> the object is : ', data.value);
    const response = {
      "id": "walletId",
      "merchantId": data.value.merchantId,
      "ownerName": data.value.ownerName,
      "balance": 0,
    };

    console.log('\n\n\n\n Returning a response.....');
    this.kafkaHelper.send(response, 'subscription', process.env.WALLET_CREATE_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.ownerId, message: '[wallet microservice] Created wallet successfully' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern(process.env.BILLING_SERVICE_COST_REQUEST_TOPIC)
  async billServiceCostResponse(@Payload() data) {
    console.log('\n\n\n\n Returning a response.....');

    const response = {
      "result": 1.25, // due sms number
      "transactionId": data.value.transactionId,
      "productName": data.value.productName
    };

    this.kafkaHelper.send(response, 'serviceCost', process.env.BILLING_SERVICE_COST_RESPONSE_TOPIC);
    
    // const status = { merchantId: data.value.merchantId, message: '[billing microservice] Billed service cost successfully...' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern(process.env.WALLET_SMS_ALLOCATE_REQUEST_TOPIC)
  async smsAllocation(@Payload() data) {
    console.log('\n\n\n\n Returning a response.....');

    const response = {
      "transactionId": data.value.transactionId,
      "status": "SUCCESS",
    }

    this.kafkaHelper.send(response, 'serviceCost', process.env.WALLET_SMS_ALLOCATE_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.merchantId, message: '[wallet microservice] SMS allocated successfully to your wallet!' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern(process.env.WALLET_SMS_BALANCE_REQUEST_TOPIC)
  async smsBalance(@Payload() data) {
    console.log('\n\n\n\n Returning a response.....');

    const response = {
      "transactionId": data.value.transactionId,
      "balance": "4",
    }

    this.kafkaHelper.send(response, 'serviceCost', process.env.WALLET_SMS_BALANCE_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.merchantId, message: '[wallet microservice] Returned SMS balance successfully' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern(process.env.WALLET_SMS_DEDUCT_REQUEST_TOPIC)
  async smsDeduction(@Payload() data) {
    console.log('\n\n\n\n Returning a response sms deduction.....');

    const response = {
      "status": 'SUCCESS',
      "transactionId": data.value.transactionId,
    };

    this.kafkaHelper.send(response, 'mtnAgentResponse', process.env.WALLET_SMS_DEDUCT_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.merchantId, message: '[wallet microservice] Deducted sms successfully...' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern('ussd-gateway-agent-request')
  async vodacomAgent(@Payload() payload) {
    const res = payload.value;

    const response: GatewayModel = res;
    response.action = 'fc';
    response.response = Math.random().toString();

    this.kafkaHelper.send(response, 'gw response', 'ussd-gateway-agent-response');

    console.log('sent the response back to vodacom agent');
  }
}
