import { Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class CustomKafka extends ClientKafka {

    // overriding response topic generation to uses our own
    protected getResponsePatternName(pattern: string): string {
        return `${pattern}.response`;
    }
}
