import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Client, MessagePattern, Payload } from '@nestjs/microservices/decorators';
import { ClientKafka, Transport } from '@nestjs/microservices';
import { KafkaHelper } from './utils/kafka-helper';
import { GatewayModel } from './dto/gateway.dto';
import axios from 'axios';
require('dotenv').config();
const Joi = require('joi');
const colors = require('colors/safe');
const qs = require('qs');
@Controller('/api/v1')
export class AppController {
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
  //
  private purchaseErrors = [];
  private purchaseSuccess = [];
  private paymentTransactionId = null;
  private readonly PURCHASE_PROCESS = 4;


  async onModuleInit() {
    console.log('>>> initated the app')
    await this.client.connect();
  }
  constructor(
    private readonly kafkaHelper: KafkaHelper,
  ) { }

  /**
   *? 1. (Purchase SMS)(4 process) contains:
   * 1. Billing service cost request -> billing ms
   * 2. Payment request -> OPay API
   * 3. SMS Allocation request -> wallet ms
   * 4. Send a notification email for confirming payment-> Notification API
   * 
   * 
   *? 2. (Send SMS) (3 process)
   *  i. Check balance request -> wallet ms
   *  ii. Send SMS request -> SMS GW ms
   *  iii. Deduct SMS request -> wallet ms
  
   *? 3. (Create Wallet) (2 process)
   *  i. Billing subscription request -> billing ms
   *  ii. Wallet creation request -> wallet ms
   * 
   * The test to be a success, you should see the aggregate results as Purchase(- Success (2/2) ))
   */

  @Post('/testSMSAPI')
  async testSMSAPI(@Req() request: any, @Res() res) {
    this.purchaseSuccess = [];
    this.purchaseErrors = [];

    const purchaseRequestPayload = {
      "telephoneNumber": "250782228870",
      "amount": 8
    };

    const sendSMSRequestPayload = {
      "title": "Oltranz",
      "message": "Test message",
      "receivers": ["250782228870"]
    };

    // authenticate
    const token = await this.authenticate();

    // const data = await this.sendRequest('http://localhost:3000/api/v1/sms/send', purchaseRequestPayload);
    await this.sendRequest('http://localhost:3000/api/v1/sms/buy', purchaseRequestPayload, token);


    return res.send('Started tests successfully, please checkout the console for aggregated results');
  }

  async sendRequest(url: string, request: any, token: string) {
    try {
      let { data } = await axios.post(url, request, { headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + token } });

      return data;
    } catch (error) {
      console.log(`Error occured while calling backend on OUR SMS API TEST MOCK on this URL: ${url}\n`, error.response.data);
      return null;
    }
  }

  async authenticate() {
    let config = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

    const payload = {
      client_secret: 'b07f33a3-ce6f-493f-8e35-f80904390661',
      client_id: 'amily-inc',
      grant_type: 'client_credentials'
    }

    try {
      const res = await axios.post(
        'https://auth.oltranz.com/auth/realms/api/protocol/openid-connect/token',
        qs.stringify(payload),
        config);

      // Set the token that will be used across other tests
      const token = res.data.access_token;
      return token;
    } catch (error) {
      console.log('\n\n\n>>> the error of authentication \n\n\n', error);
    }
  };

  //** START OF KEYCLOAK TEST RESPONSES */
  @Get('')
  async testKeycloakSMSAPI() {
    console.log('\n\n\n\n send data to sms api to test keycloak...');

    const request = {
      clientId: "basesms",
      eventType: "REGISTER",
      userId: "description",
      customerInfo: { attributes: { phoneNumber: ["250782228870"], email: ['test@gmail.com'], username: ['elonmusk'] } },
    };

    this.kafkaHelper.send(request, 'keycloak', process.env.KEYCLOAK_REGISTER_TOPIC);
  }
  //** END OF KEYCLOAK TEST RESPONSES */



  //** START OF WALLET CREATION TEST RESPONSES */
  @MessagePattern(process.env.BILLING_SUBSCRIPTION_REQUEST_TOPIC)
  async setSubscriptionPayment(@Payload() data) {
    console.log('\n\n\n\n Returning a response.....');

    const response = { "msg": "description" };

    this.kafkaHelper.send(response, 'subscription', process.env.BILLING_SUBSCRIPTION_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.merchantId, message: '[billing microservice] The subscription payment is set successfully' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern(process.env.WALLET_CREATE_REQUEST_TOPIC)
  async createWallet(@Payload() data) {
    console.log('>>> the object is : ', data.value);
    const response = {
      "id": "walletId",
      "merchantId": data.value.ownerId,
      "ownerName": data.value.ownerName,
      "balance": 0,
    };

    console.log('\n\n\n\n Returning a response.....');
    this.kafkaHelper.send(response, 'subscription', process.env.WALLET_CREATE_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.ownerId, message: '[wallet microservice] Created wallet successfully' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }
  //** END OF WALLET CREATION TEST RESPONSES */



  //** START OF PURCHASE TEST RESPONSES */
  @MessagePattern(process.env.BILLING_SERVICE_COST_REQUEST_TOPIC)
  async billServiceCostResponse(@Payload() data) {
    console.log('\n (PURCHASE REQUEST)\n');
    this.validateBillServiceCostRequest(data.value, 'purchaseInfo', 'BillServiceCost');


    const response = {
      "result": 1.25, // due sms number
      "transactionId": data.value.transactionId,
      "productName": data.value.productName
    };

    this.kafkaHelper.send(response, 'serviceCost', process.env.BILLING_SERVICE_COST_RESPONSE_TOPIC);
  }

  @MessagePattern(process.env.WALLET_SMS_ALLOCATE_REQUEST_TOPIC)
  async smsAllocation(@Payload() data) {
    this.validateSMSAllocationRequest(data.value, 'purchaseInfo', 'SMSAllocation');

    const response = {
      "transactionId": data.value.transactionId,
      "status": "SUCCESS",
    }

    this.kafkaHelper.send(response, 'serviceCost', process.env.WALLET_SMS_ALLOCATE_RESPONSE_TOPIC);
  }

  @Post('/opay')
  async opayPaymentRequest(@Body() request: any, @Res() res) {
    this.validateOpayRequest(request, 'purchaseInfo', 'PaymentRequest');

    const response = {
      code: '200',
    }

    this.paymentTransactionId = request.transactionId;

    // Call payment callback after 2 seconds
    setTimeout(async () => {
      // payment callback response
      const paymentCallback = {
        "statusDescription": "PAID DONE SUCCESSFULLY",
        "spTransactionId": "1189008900089",
        "walletTransactionId": "142bd904043011e989e1a30736f9425c",
        "chargedCommission": 2.5,
        "currency": "RWF",
        "paidAmount": 8,
        "transactionId": this.paymentTransactionId,
        "statusCode": "200",
        "status": "SUCCESS"
      };

      await this.sendRequest('http://localhost:3000/api/v1/sms/payments/callback', paymentCallback, '');
    }, 2000);

    return res.status(200).json(response);
  }

  @Post('/notifications')
  async emailNotificationRequest(@Body() request: any, @Res() res) {
    this.validateEmailNotificationRequest(request, 'purchaseInfo', 'SendEmailNotificationRequest');

    const response = {
      statusCode: '200',
    }

    return res.status(200).json(response);
  }
  //** END OF PURCHASE TEST RESPONSES */



  //** START OF SENDING SMS TEST RESPONSES */
  @MessagePattern(process.env.WALLET_SMS_BALANCE_REQUEST_TOPIC)
  async smsBalance(@Payload() data) {
    const response = {
      "transactionId": data.value.transactionId,
      "balance": "4",
    }

    this.kafkaHelper.send(response, 'serviceCost', process.env.WALLET_SMS_BALANCE_RESPONSE_TOPIC);

    // const status = { merchantId: data.value.merchantId, message: '[wallet microservice] Returned SMS balance successfully' };
    // this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }

  @MessagePattern(process.env.WALLET_SMS_DEDUCT_REQUEST_TOPIC)
  async smsDeduction(@Payload() data) {
    console.log('\n\n\n\n Returning a response sms deduction.....');

    const response = {
      "status": 'SUCCESS',
      "transactionId": data.value.transactionId,
    };

    this.kafkaHelper.send(response, 'mtnAgentResponse', process.env.WALLET_SMS_DEDUCT_RESPONSE_TOPIC);

    const status = { merchantId: data.value.merchantId, message: '[wallet microservice] Deducted sms successfully...' };
    this.kafkaHelper.send(status, 'requestStatusTracking', process.env.REQUEST_STATUS_TRACKING_TOPIC);
  }
  //** END OF SENDING SMS TEST RESPONSES */



  //** START OF VODACOM AGENT TEST RESPONSES */
  @MessagePattern('ussd-gateway-agent-request')
  async vodacomAgent(@Payload() payload) {
    const res = payload.value;

    const response: GatewayModel = res;
    response.action = 'fc';
    response.response = Math.random().toString();

    this.kafkaHelper.send(response, 'gw response', 'ussd-gateway-agent-response');

    console.log('sent the response back to vodacom agent');
  }


















  //** START OF VALIDATION FOR PURCHASE FUNCTIONALITIES*/
  validate(schema, request, requestType, categoryName) {
    const { error } = schema.validate(request);
    if (error) {
      console.log(`1. ${colors.red('ERROR')} (${requestType}) ==> `, error.message);
      console.log(`(${requestType}) request sent is: `, request);

      this.aggregateResults({ category: { name: categoryName, error: error.message } });
      return { error: error.message }
    };

    console.log(`1. ${colors.green('SUCCESS')} (${requestType}) request is VALID ==> `, request);
    this.aggregateResults({ category: { name: categoryName, success: request.transactionId } });
  }

  //** START OF VALIDATION FOR PURCHASE FUNCTIONALITIES*/
  validateOpayRequest(request: any, categoryName: string, requestType: string) {
    const schema = Joi.object({
      telephoneNumber: Joi.string()
        .min(6)
        .max(30)
        .required(),
      organizationId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      transactionId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      callbackUrl: Joi.string()
        .min(15)
        .max(255)
        .required(),
      description: Joi.string()
        .min(1)
        .max(255)
        .required(),
      amount: Joi.number()
        .valid(6.4) // fixed amount
        .required()
    });

    this.validate(schema, request, requestType, categoryName);
  }

  validateSMSAllocationRequest(request: any, categoryName: string, requestType: string) {
    const schema = Joi.object({
      merchantId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      transactionId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      description: Joi.string()
        .min(1)
        .max(255)
        .required(),
      amount: Joi.number()
        .valid(1) // fixed amount
        .required()
    });

    this.validate(schema, request, requestType, categoryName);
  }

  validateEmailNotificationRequest(request: any, categoryName: string, requestType: string) {
    // {
    //   sender: { name: 'Oltranz ltd', email: 'accounts@oltranz.com' },
    //   to: [{ email: 'amilykassim012@gmail.com' }],
    //     subject: 'Purchased SMS successfully',
    //       htmlContent: '<p><b>SMS purchase done successfully!</b></p>'
    // }

    const receiverEmailSchema = Joi.object({ email: Joi.string().email().required() });
    const senderSchema = Joi.object().keys({ name: Joi.string().min(1).max(255).required(), email: Joi.string().email().required() });
    // const sender = Joi.object({ email: Joi.string().email().required() });

    const schema = Joi.object({
      to: Joi.array()
        .items(receiverEmailSchema)
        .required(),
      sender: senderSchema,
      subject: Joi.string()
        .min(1)
        .max(255)
        .required(),
      htmlContent: Joi.string()
        .min(1)
        .max(255)
        .required()
    });

    this.validate(schema, request, requestType, categoryName);
  }

  validateBillServiceCostRequest(request: any, categoryName: string, requestType: string) {
    const schema = Joi.object({
      merchantId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      transactionId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      productName: Joi.string()
        .valid('SMS') // fixed string valud
        .required(),
      amount: Joi.number()
        .valid(8) // fixed amount
        .required()
    });

    this.validate(schema, request, requestType, categoryName);
  }

  aggregateResults(result) {
    const { category } = result;
    if (category.name == 'purchaseInfo') this.addPurchaseResults(category);


    const purchaseErrorsResults = Array.from(new Set(this.purchaseErrors));
    const purchaseSuccessResults = Array.from(new Set(this.purchaseSuccess));
    console.log(`Final results: 
    ${(purchaseSuccessResults.length == this.PURCHASE_PROCESS) ? '✅ ' : '🔴'} Purchase:
          1. Success -> (${(purchaseSuccessResults.length)}/${this.PURCHASE_PROCESS})
          2. Errors -> (${(purchaseErrorsResults.length)} errors -> `, purchaseErrorsResults);
  }

  addPurchaseResults(purchaseInfo) {
    const { error, success } = purchaseInfo
    if (error) this.purchaseErrors.push(error)
    else this.purchaseSuccess.push(success)
  }
}
