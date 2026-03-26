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
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.templatesService.findAll(req.user.id, req.user.plan);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.templatesService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.templatesService.remove(req.user.id, id);
  }
}
