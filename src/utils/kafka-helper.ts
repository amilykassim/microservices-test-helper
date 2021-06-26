import { Injectable } from '@nestjs/common';
const { Kafka } = require('kafkajs');
require('dotenv').config();

@Injectable()
export class KafkaHelper {
  private producer;

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
    const messageToBeSent = JSON.stringify(data);

    try {
      // Send the event data to kafka
      await this.producer.send({
        topic: topic,
        messages: [{ value: messageToBeSent }],
      });

      return { isMessageSent: true };
    } catch (error) {
      console.log("An error occured while sending data to kafka, here is the error: ", error);
      
    }
  }
}
