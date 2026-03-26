import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateClientDto) {
    return this.clientsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req, @Query() query: ListClientsDto) {
    return this.clientsService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.clientsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.clientsService.remove(req.user.id, id);
  }
}
