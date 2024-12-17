import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GmailModule } from './gmail/gmail.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot(),GmailModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
