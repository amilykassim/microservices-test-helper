import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
require('dotenv').config()

async function bootstrap() {
  const port = process.env.PORT || 4000;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: [process.env.KAFKA_BROKER_URL],
        },
        consumer: {
          groupId: 'api-helper-tester-group',
        },
      },
    },
  );

  app.listen(() => console.log(`>>>> Starting the sms gateway on port ${port}`));
}
bootstrap();
