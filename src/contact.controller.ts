import { Controller } from '@nestjs/common';
import { Client, MessagePattern, Payload } from '@nestjs/microservices/decorators';
import { ClientKafka, Transport } from '@nestjs/microservices';
import { KafkaHelper } from './utils/kafka-helper';
import { GatewayModel } from './dto/gateway.dto';
require('dotenv').config();
@Controller('/api/v1')
export class ContactController {
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
    await this.client.connect();
  }
  constructor(
    private readonly kafkaHelper: KafkaHelper,
  ) { }


  @MessagePattern('sms-contacts-validate-request-topic')
  async validateContacts(@Payload() { value }) {
    console.log('\n\n\n\n>>> receive')

    const response = {
      statusCode: 200,
      trackId: value.trackId,
      customerId: value.customerId,
      noOfValidContacts: 100,
      noOfInValidContacts: 50
    };

    this.kafkaHelper.send(response, 'validate response', 'sms-contacts-validate-response-topic');
    console.log('sent the response back to vodacom agent');
  }

  @MessagePattern('sms-contacts-get-contacts-request-topic')
  async getContacts(@Payload() { value }) {
    console.log('\n\n\n\n>>> receive');
    const response = {
      statusCode: 200,
      trackId: value.trackId,
      customerId: value.customerId,
      "id": "567uaf9a7fauf",
      "groupName": "VIP",
      "noOfContacts": 2,
      "contacts": [{ "phoneNumber": "250782228870" }, { "phoneNumber": "250782228871" }],
      "createdAt": "2017-02-18 17:39:15.014961-05",
    }

    this.kafkaHelper.send(response, 'contacts response', 'sms-contacts-get-contacts-response-topic');
    console.log('sent the response back to vodacom agent');
  }

  @MessagePattern('sms-contacts-get-groups-request-topic')
  async getGroups(@Payload() { value }) {
    console.log('\n\n\n\n>>> receive');
    const groups = [
      {
        "id": "567uaf9a7fauf",
        "groupName": "Ignite",
        "noOfContacts": 2,
        "createdAt": "2017-02-18 17:39:15.014961-05",
      },
      {
        "id": "uaf9aasfdhaa",
        "groupName": "Sator",
        "noOfContacts": 2,
        "createdAt": "2017-02-18 17:39:15.014961-05",
      }];

    const response = {
      statusCode: 200,
      trackId: value.trackId,
      customerId: value.customerId,
      groups
    }

    this.kafkaHelper.send(response, 'contacts response', 'sms-contacts-get-groups-response-topic');
    console.log('sent the response back to vodacom agent');
  }



















}
