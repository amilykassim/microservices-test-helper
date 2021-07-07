import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SendController } from './send.controller';
import { KafkaHelper } from './utils/kafka-helper';
const xmlParser = require ('express-xml-bodyparser');

@Module({
  imports: [],
  controllers: [AppController, SendController],
  providers: [AppService, KafkaHelper],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(xmlParser())
      .forRoutes('');
  }
}
