import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Auth, google} from 'googleapis';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class GmailService {
    private oAuth2Client: Auth.OAuth2Client;
    private readonly logger = new Logger('GmailService');

  constructor() {
    this.getConexion();
  }

  private getConexion() {
    try {
      this.oAuth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI
      );

      this.oAuth2Client.setCredentials({
        refresh_token: process.env.REFRESH_TOKEN,
      });

      this.oAuth2Client.getAccessToken((err, token) => {
        console.log(token);
        if(err){
          console.log(err);
        }
      });
    } catch (error) {
      console.log(error);
    }
  }

  //Obtener todos los emails
  async getAllEmails() {
    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
    });

    const messages = response.data.messages;
    let received = '';
    let from = '';
    let subject = '';

    const messagesPromises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });

      if (msg.data.payload) {
        const headers = msg.data.payload.headers;

        let receivedArray = headers
          .find((header) => header.name === 'Received')
          .value.split(';')
          .map((received) => received.trim());

        received = receivedArray[1];
        from = headers.find((header) => header.name === 'From').value.trim();
        subject = headers
          .find((header) => header.name === 'Subject')
          .value.trim();
      }

      const cleanSnippet = msg.data.snippet
        // Eliminar emojis y caracteres especiales Unicode
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        // Normalizar caracteres acentuados
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Eliminar caracteres invisibles y espacios especiales
        .replace(
          /[\u200B-\u200D\uFEFF\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g,
          ' ',
        )
        // Eliminar caracteres de control
        .replace(
          /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
          '',
        )
        // Limpiar puntuación y espacios
        .replace(/\s*\.\s*/g, '. ') // Normalizar espacios alrededor de puntos
        .replace(/\s+/g, ' ') // Convertir múltiples espacios en uno solo
        .replace(/\s+\./g, '.') // Eliminar espacios antes de puntos
        .replace(/\.\s+/g, '. ') // Normalizar espacios después de puntos
        .trim()
        // Mantener solo caracteres imprimibles básicos
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');

      return {
        id: msg.data.id,
        snippet: cleanSnippet,
        received,
        from,
        subject,
        formatDate: this.formatDate(received),
        content: `${process.env.BASE_URL}/email/${msg.data.id}/html`,
      };
    });
    return Promise.all(messagesPromises);
  }
  
  //Obtener email por id para mostrarlo en formato HTML
  async getEmailHtml(id: string) {
    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });

    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: id,
      });

      const content = this.extractMessageContent(msg.data.payload);
      return content;
    } catch (error) {
      this.handleExceptions(error, id);
    }
  }

  //Obtenr email por id
  async getEmailById(id: string) {
    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: id,
      });

      let received = '';
      let from = '';
      let subject = '';
      if (msg.data.payload) {
        const headers = msg.data.payload.headers;

        let receivedArray = headers
          .find((header) => header.name === 'Received')
          .value.split(';')
          .map((received) => received.trim());

        received = receivedArray[1];
        from = headers.find((header) => header.name === 'From').value.trim();
        subject = headers
          .find((header) => header.name === 'Subject')
          .value.trim();
      }

      const cleanSnippet = msg.data.snippet
        // Eliminar emojis y caracteres especiales Unicode
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        // Normalizar caracteres acentuados
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Eliminar caracteres invisibles y espacios especiales
        .replace(
          /[\u200B-\u200D\uFEFF\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g,
          ' ',
        )
        // Eliminar caracteres de control
        .replace(
          /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
          '',
        )
        // Limpiar puntuación y espacios
        .replace(/\s*\.\s*/g, '. ') // Normalizar espacios alrededor de puntos
        .replace(/\s+/g, ' ') // Convertir múltiples espacios en uno solo
        .replace(/\s+\./g, '.') // Eliminar espacios antes de puntos
        .replace(/\.\s+/g, '. ') // Normalizar espacios después de puntos
        .trim()
        // Mantener solo caracteres imprimibles básicos
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');

      return {
        id: msg.data.id,
        snippet: cleanSnippet,
        received,
        from,
        subject,
        formatDate: this.formatDate(received),
        content: `${process.env.BASE_URL}/email/${msg.data.id}/html`,
      };
    } catch (error) {
      this.handleExceptions(error, id);
    }
  }

  //Envio de email
  async sendEmail(emailData: SendEmailDto) {
    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });

    // Crear el contenido del email en formato RFC 822
    const utf8Subject = `=?utf-8?B?${Buffer.from(emailData.subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${emailData.to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      emailData.message,
    ];

    const emailContent = messageParts.join('\n');

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    //Para enviar el email
    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          snippet: emailData.snippet || emailData.subject,
        },
      });

      return response.data;
    } catch (error) {
      this.handleExceptions(error, 'send');
      throw new InternalServerErrorException(
        'Error al enviar el email. Por favor intente más tarde.',
      );
    }
  }

  //Eliminar email por id
  async deleteEmail(id: string) {
    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });

    try {
      await gmail.users.messages.trash({
        userId: 'me',
        id: id,
      });

      return {
        status: 200,
        message: 'Email eliminado correctamente',
        id,
      };
    } catch (error) {
      this.handleExceptions(error, id);
    }
  }
  //--------------------Metodos auxiliares--------------------
  private formatDate(received: string) {
    const date = new Date(received);

    const formatter = new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    });

    return formatter.format(date);
  }

  private extractMessageContent(payload: any): string {
    let content = '';

    // Caso base: contenido simple
    if (payload.body && payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    // Caso recursivo: contenido multipart
    if (payload.parts) {
      for (const part of payload.parts) {
        // Priorizar contenido HTML
        if (part.mimeType === 'text/html') {
          content = this.extractMessageContent(part);
          break;
        }
        // Si no hay HTML, usar texto plano
        if (part.mimeType === 'text/plain') {
          content = this.extractMessageContent(part);
        }
        // Recursión para partes anidadas
        if (part.parts) {
          content = this.extractMessageContent(part);
        }
      }
    }

    return content;
  }
  private handleExceptions(error: any, id: string) {
    if (error.code === 400) {
      throw new NotFoundException(`Mail with id '${id}' does not exist.`);
    }

    if (error?.response?.data?.error?.message) {
      throw new BadRequestException(error.response.data.error.message);
    }

    if (error.code === 401) {
      throw new UnauthorizedException('No autorizado para enviar emails');
    }

    console.log(error);

    this.logger.error(error);
  }

}   
