import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SendController } from './send.controller';
import { KafkaHelper } from './utils/kafka-helper';

@Module({
  imports: [],
  controllers: [AppController, SendController],
  providers: [AppService, KafkaHelper],
})
export class AppModule {}
