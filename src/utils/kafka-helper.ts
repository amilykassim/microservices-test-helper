import { Injectable } from '@nestjs/common';
const { Kafka } = require('kafkajs');
require('dotenv').config(); // setup the necessary kafka configs
const apm = require('elastic-apm-node').start();

@Injectable()
export class KafkaHelper {
  private producer;
  private transaction;

  constructor() {
    const kafka = new Kafka({
      brokers: [process.env.KAFKA_BROKER_URL],
    });

    // assign the configs to the producer
    this.producer = kafka.producer();
    this.producer.connect().then(() => {
    });
  }
  async send(data, transactionName: string, topic: string) {
    // start apm transaction
    this.transaction = apm.startTransaction(transactionName, 'Kafka');

    const messageToBeSent = JSON.stringify(data);

    try {
      // Send the event data to kafka
      await this.producer.send({
        topic: topic,
        messages: [{ value: messageToBeSent }],
      });

      // sent sms successfully to respective agent
      this.transaction.result = 'success';
      this.transaction.end();

      return { isMessageSent: true };
    } catch (error) {

      // failed to send sms to respective agent
      this.transaction.result = 'error';
      this.transaction.end();
    }
  }
}
