import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaHelper } from './utils/kafka-helper';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, KafkaHelper],
})
export class AppModule {}
