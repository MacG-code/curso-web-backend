import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { SendEmailDto } from './dto/send-email.dto';

@Controller()
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  //Obtener todos los emails
  @Get('emails')
  findAll() {
    return this.gmailService.getAllEmails();
  }

  //Obtener email por id para mostrarlo en formato HTML
  @Get('email/:id/html')
  findOneHtml(@Param('id') id: string) {
    return this.gmailService.getEmailHtml(id);
  }

  @Get('email/:id')
  findOne(@Param('id') id: string) {
    return this.gmailService.getEmailById(id);
  }

  //Envio de email
  @Post('send-email')
  sendEmail(@Body() emailData: SendEmailDto) {
    return this.gmailService.sendEmail(emailData);
  }

  //Eliminar email por id
  @Delete('email/:id')
  deleteEmail(@Param('id') id: string) {
    return this.gmailService.deleteEmail(id);
  }
}
