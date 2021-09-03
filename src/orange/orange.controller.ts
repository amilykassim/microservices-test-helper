import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Client, MessagePattern, Payload } from '@nestjs/microservices/decorators';
import { ClientKafka, Transport } from '@nestjs/microservices';
import axios from 'axios';
import { KafkaHelper } from 'src/utils/kafka-helper';
require('dotenv').config();
const Joi = require('joi');
const colors = require('colors/safe');
const qs = require('qs');
@Controller('/api/v1')
export class OrangeController {
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

  @Post('/orange/sms')
  async testSMSAPI(@Req() request: any, @Res() res) {
    const sms = {
        title: '2782',
        message: 'test',
        receiver: '2579'
      };
    
    await this.kafkaHelper.send(sms, 'orange-sms', process.env.ORANGE_SMS_AGENT_REQUEST_TOPIC);
		console.log('Sent sms sample to the orange agent');

    return res.send('Started tests successfully, please checkout the console for aggregated results');
  }
}
