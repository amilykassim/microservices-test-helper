import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Client, MessagePattern, Payload } from '@nestjs/microservices/decorators';
import { ClientKafka, Transport } from '@nestjs/microservices';
import { KafkaHelper } from './utils/kafka-helper';
import { GatewayModel } from './dto/gateway.dto';
import axios from 'axios';
import { RedisHelper } from './utils/redis-helper';
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

  // PURCHASE SMS STATISTICS VARIABLES
  private purchaseErrors = [];
  private purchaseSuccess = [];
  private paymentTransactionId = null;
  private readonly PURCHASE_PROCESS = 4;
  private readonly PURCHASE_CATEGORY = 'purchaseInfo';
  private readonly purchaseProcess = {
    'BillServiceCost': false,
    'PaymentRequest': false,
    'SMSAllocation': false,
    'SendEmailNotificationRequest': false,
  };

  // SEND SMS STATISTICS VARIABLES
  private sendSMSErrors = [];
  private sendSMSSuccess = [];
  private readonly SEND_SMS_PROCESS = 3;
  private readonly SEND_SMS_CATEGORY = 'sendSMSInfo';

  // DELETER LATER
  private amountToDeduct = 0;


  async onModuleInit() {
    await this.client.connect();
  }
  constructor(
    private readonly kafkaHelper: KafkaHelper,
    private readonly redisHelper: RedisHelper,
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
   *  iii. Receive a response from agent and Deduct SMS request -> wallet ms
  
   *? 3. (Create Wallet) (2 process)
   *  i. Billing subscription request -> billing ms
   *  ii. Wallet creation request -> wallet ms
   * 
   * The test to be a success, you should see the aggregate results as Purchase(- Success (2/2) ))
   */


  @Get('/deleteRedis')
  async deleteDataFromRedis(@Req() request: any, @Res() res) {

    const smstodelete = await this.getSMSFromRedis('retriable-mtn-campaign');
    for (let sms of smstodelete) {
      await this.deleteSMSFromRedis(sms);
    }

    return res.send('Delete successfully');
  }

  async deleteSMSFromRedis(sms) {
    return this.redisHelper.unlink(`retriable-mtn-campaign-${sms.metadata['smsGw']['campaignId']}-${sms.receiver}`);
  }

  async getSMSFromRedis(key: string) {
    const data = [];
    const keys = await this.redisHelper.getKeys(key);
    for (let i = 0; i < keys.length; i++) {
      const sms = await this.redisHelper.get(keys[i]);
      data.push(sms);
    }
    return data;
  }

  @Post('/testSMSAPI')
  async testSMSAPI(@Req() request: any, @Res() res) {
    this.purchaseSuccess = [];
    this.purchaseErrors = [];
    this.purchaseProcess['BillServiceCost'] = false;
    this.purchaseProcess['PaymentRequest'] = false;
    this.purchaseProcess['SMSAllocation'] = false;
    this.purchaseProcess['SendEmailNotificationRequest'] = false;

    const purchaseRequestPayload = {
      "telephoneNumber": "250782228870",
      "amount": 8
    };

    const sendSMSRequestPayload = {
      "title": "Oltranz",
      "message": "Test message",
      "receivers": ["250782228870"],
      "contactListName": "VIP customers"
    };

    // authenticate
    const token = await this.authenticate();

    // send requests to tests
    await this.sendRequest('http://localhost:3000/api/v1/sms/send', sendSMSRequestPayload, token);
    // await this.sendRequest('http://localhost:3000/api/v1/sms/buy', purchaseRequestPayload, token);

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
      client_secret: '2b445b2d-de10-442d-85ae-960f6267881a',
      client_id: 'amily-inc',
      grant_type: 'client_credentials'
    }

    try {
      const res = await axios.post(
        'https://auth.oltranz.com/auth/realms/api-dev/protocol/openid-connect/token',
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
    console.log('>>> the wallet object is : ', data.value);
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
    this.validateBillServiceCostRequest(data.value, this.PURCHASE_CATEGORY, 'BillServiceCost');

    const response = {
      "result": 1.25, // due sms number
      "transactionId": data.value.transactionId,
      "productName": data.value.productName
    };

    this.kafkaHelper.send(response, 'serviceCost', process.env.BILLING_SERVICE_COST_RESPONSE_TOPIC);
  }

  @MessagePattern(process.env.WALLET_SMS_ALLOCATE_REQUEST_TOPIC)
  async smsAllocation(@Payload() data) {
    this.validateSMSAllocationRequest(data.value, this.PURCHASE_CATEGORY, 'SMSAllocation');

    const response = {
      transactionId: data.value.transactionId,
      status: "SUCCESS",
      description: "Done successfully",
      trackId: data.value.trackId,
      smsBalance: 10,
      metadata: {
        request: {
          merchantId: "03ed9d0e-7c8e-4880-b9f0-004a071fa10f",
          amount: 10,
          description: "SMS Allocation",
          transactionId: data.value.transactionId,
          trackId: data.value.trackId,
          metadata: {
            email: 'amily@gmail.com'
          }
        }
      },
      smsAllocated: 10
    };

    this.kafkaHelper.send(response, 'serviceCost', process.env.WALLET_SMS_ALLOCATE_RESPONSE_TOPIC);
  }

  @Post('/opay')
  async opayPaymentRequest(@Body() request: any, @Res() res) {
    this.validateOpayRequest(request, this.PURCHASE_CATEGORY, 'PaymentRequest');

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
    this.validateEmailNotificationRequest(request, this.PURCHASE_CATEGORY, 'SendEmailNotificationRequest');

    const response = {
      statusCode: '200',
    }

    return res.status(200).json(response);
  }
  //** END OF PURCHASE TEST RESPONSES */



  //** START OF SENDING SMS TEST RESPONSES */
  @MessagePattern(process.env.WALLET_SMS_BALANCE_REQUEST_TOPIC)
  async smsBalance(@Payload() data) {
    this.validateCheckSMSBalanceRequest(data.value, this.SEND_SMS_CATEGORY, 'CheckSMSBalance')
    const response = {
      transactionId: data.value.transactionId,
      balance: "10",
      trackId: data.value.trackId,
      status: 'SUCCESS',
      metadata: {
        "request": {
           "merchantId": data.value.merchantId,
           "transactionId": data.value.transactionId,
           "trackId": data.value.trackId,
           "onlyCheckSMSWalletBalance": false,
           "metadata": {
              "request": {
                 "title": "Test",
                 "message": data.value.metadata.request.message,
                 "receivers": data.value.metadata.request.receivers,
                 "callbackUrl": data.value.metadata.request.callbackUrl,
                 "customerId": data.value.merchantId,
                 "trackId": data.value.trackId,
                 "metadata": {
                    "smsApi": {
                       "campaignId": "d190b660-c14d-4b45-9af3-068ff3bf5aa6",
                       "launcherPhoneNumber": "250782228870"
                    }
                 }
              },
              "userInfo": {
                 "name": "service-account-amily-inc",
                 "email": "amilykassim012@gmail.com"
              }
           }
        }
     }
   }

    this.kafkaHelper.send(response, 'serviceCost', process.env.WALLET_SMS_BALANCE_RESPONSE_TOPIC);
  }

  // @MessagePattern(process.env.SMS_API_SEND_SMS_REQUEST)
  async smsGw(@Payload() data) {
    // this.validateSendSMSToGWRequest(data.value, this.SEND_SMS_CATEGORY, 'SendSMSToGW');

    console.log('\n\n>>> respond to sms api', data.value);

    const response = {
      code: '200',
      messageId: '5c44ba9a-9e2b-4c10-a66f-a21d0e615f79',
      customerId: data.value.customerId,
      trackId: data.value.trackId,
      metadata: { smsAgent: { deliveryStatus: { status: 'success' } } }
    };

    this.kafkaHelper.send(response, 'serviceCost', process.env.MTN_AGENT_RESPONSE_TOPIC);
  }

  @MessagePattern(process.env.WALLET_SMS_DEDUCT_REQUEST_TOPIC)
  async smsDeduction(@Payload() data) {
    // this.validateSMSDeductRequest(data.value, this.SEND_SMS_CATEGORY, 'DeductSMS');
    console.log(data.value);
    this.amountToDeduct += data.value.amount;

    console.log('\n\n The total: ', this.amountToDeduct);

    const response = {
      transactionId: data.value.transactionId,
      status: "SUCCESS",
      description: "Done successfully",
      trackId: "f054d708-2ad9-4798-8c96-9ba6927c14b1",
      smsBalance: 429468,
      metadata: {
        request: {
          merchantId: "db8aae67-8353-45dd-91f7-7c85d3900646",
          amount: 1,
          transactionId: data.value.transactionId,
          trackId: "f054d708-2ad9-4798-8c96-9ba6927c14b1",
        }
      },
      smsDeducted: 1
    }

    this.kafkaHelper.send(response, 'mtnAgentResponse', process.env.WALLET_SMS_DEDUCT_RESPONSE_TOPIC);
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


















  validate(schema, request, requestType, categoryName) {
    const { error } = schema.validate(request);
    if (error) {
      console.log(`1. ${colors.red('ERROR')} (${requestType}) ==> `, error.message);
      console.log(`(${requestType}) request sent is: `, request);

      this.aggregateResults({ category: { name: categoryName, error: error.message } });
      return { error: error.message }
    };

    // console.log(`1. ${colors.green('SUCCESS')} (${requestType}) request is VALID ==> `, request);

    if (categoryName == this.PURCHASE_CATEGORY) this.purchaseProcess[requestType] = true;
    // if (categoryName == this.SEND_SMS_CATEGORY) this.purchaseProcess[requestType] = true;

    return this.aggregateResults({ category: { name: categoryName, success: request.transactionId } });
  }

  aggregateResults(result) {
    const { category } = result;
    if (category.name == this.PURCHASE_CATEGORY) {
      this.addPurchaseResults(category);

      return console.log(`Final results: 
        ${(this.purchaseSuccess.length == this.PURCHASE_PROCESS) ? '✅ ' : '🔴'} Purchase:
          1. Success -> (${(this.purchaseSuccess.length)}/${Object.keys(this.purchaseProcess).length})
              ${this.displayProcess(this.purchaseProcess)}
          2. Errors -> (${(this.purchaseErrors.length)} errors -> `, this.purchaseErrors);
    }
    if (category.name == this.SEND_SMS_CATEGORY) {
      this.addSendSMSResults(category);

      return console.log(`Final results: 
        ${(this.sendSMSSuccess.length == this.SEND_SMS_PROCESS) ? '✅ ' : '🔴'} SendSMS:
          1. Success -> (${(this.sendSMSSuccess.length)}/${this.SEND_SMS_PROCESS})
          2. Errors -> (${(this.sendSMSErrors.length)} errors -> `, this.sendSMSErrors);
    }
  }

  displayProcess(data) {
    let result = '  ';
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = data[key];
      result += `${i + 1}. ${key} ${(value) ? colors.green('✔') : colors.red('𐄂')}\n\t\t`
    }

    // console.log('\n\n\n\n>>>> THE DISPLAY PROCESS IS : ', data[keys[0]]);

    return result;
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

    return this.validate(schema, request, requestType, categoryName);
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
        .required(),
      trackId: Joi.string()
    });

    return this.validate(schema, request, requestType, categoryName);
  }

  validateEmailNotificationRequest(request: any, categoryName: string, requestType: string) {
    const receiverEmailSchema = Joi.object({ email: Joi.string().email().required() });
    const senderSchema = Joi.object().keys({ name: Joi.string().min(1).max(255).required(), email: Joi.string().email().required() });

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

    return this.validate(schema, request, requestType, categoryName);
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
        .required(),
      trackId: Joi.string()
    });

    return this.validate(schema, request, requestType, categoryName);
  }
  //** END OF VALIDATION FOR PURCHASE FUNCTIONALITIES*/

  //** START OF VALIDATION FOR SEND SMS FUNCTIONALITIES*/
  validateCheckSMSBalanceRequest(request: any, categoryName: string, requestType: string) {
    // check sms balance schema
    const schema = Joi.object({
      merchantId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      transactionId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      onlyCheckSMSWalletBalance: Joi.boolean()
        .valid(true)
    });

    return this.validate(schema, request, requestType, categoryName);
  }

  validateSendSMSToGWRequest(request: any, categoryName: string, requestType: string) {
    const metadataSchema = Joi.object().keys({
      smsApi: Joi.object().keys(
        {
          campaignId: Joi.string().min(10).max(255).required(),
          launcherPhoneNumber: Joi.string().min(6).max(30).required()
        })
        .required()
    });

    const schema = Joi.object({
      receiver: Joi.array()
        .items(Joi.string()
          .min(6)
          .max(30)
          .required())
        .required(),
      customerId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      message: Joi.string()
        .min(1)
        .max(255)
        .required(),
      header: Joi.string()
        .min(1)
        .max(11)
        .required(),
      metadata: metadataSchema
    });

    return this.validate(schema, request, requestType, categoryName);
  }

  validateSMSDeductRequest(request: any, categoryName: string, requestType: string) {
    const schema = Joi.object({
      merchantId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      transactionId: Joi.string()
        .min(10)
        .max(255)
        .required(),
      amount: Joi.number()
        .valid(1) // fixed amount
        .required()
    });

    return this.validate(schema, request, requestType, categoryName);
  }

  addPurchaseResults(data) {
    const { error, success } = data
    if (error) return this.purchaseErrors.push(error)
    else return this.purchaseSuccess.push(success)
  }

  addSendSMSResults(data) {
    const { error, success } = data
    if (error) return this.sendSMSErrors.push(error)
    else return this.sendSMSSuccess.push(success)
  }
}
