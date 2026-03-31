import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications (last 50)' })
  @ApiQuery({ name: 'unread', required: false, type: Boolean })
  findAll(
    @CurrentUser() user: { id: string },
    @Query('unread') unread?: string,
  ) {
    return this.svc.findAll(user.id, unread === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  async unreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.svc.countUnread(user.id);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.svc.markRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.svc.markAllRead(user.id);
  }
}
