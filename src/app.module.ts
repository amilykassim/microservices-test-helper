import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContactController } from './contact.controller';
import { OrangeController } from './orange/orange.controller';
import { SendController } from './send.controller';
import { KafkaHelper } from './utils/kafka-helper';
import { RedisHelper } from './utils/redis-helper';
const xmlParser = require('express-xml-bodyparser');

@Module({
  imports: [],
  controllers: [AppController, SendController, OrangeController, ContactController],
  providers: [AppService, KafkaHelper, RedisHelper],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(xmlParser())
      .forRoutes('');
  }
}
