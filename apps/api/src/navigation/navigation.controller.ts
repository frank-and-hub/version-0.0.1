import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NavigationService } from './navigation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMenuItemDto, UpdateMenuItemDto, UserRole } from '@monorepo/shared-types';

@ApiTags('Dynamic Navigation & Sidebar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('menu')
  @ApiOperation({ summary: 'Retrieve dynamic sidebar tree filtered by user role & permissions' })
  async getUserMenu(
    @CurrentUser('role') role: UserRole,
    @CurrentUser('permissions') permissions: string[],
    @CurrentUser('user_uuid') userUuid: string,
  ) {
    return this.navigationService.getUserMenu(role, permissions || [], userUuid);
  }

  @Get('items')
  @RequirePermissions('navigation.manage')
  @ApiOperation({ summary: 'Get all navigation items for administration' })
  async getAllItems() {
    return this.navigationService.getAllItems();
  }

  @Post('items')
  @RequirePermissions('navigation.manage')
  @ApiOperation({ summary: 'Create new navigation menu item' })
  async createItem(@Body() dto: CreateMenuItemDto) {
    return this.navigationService.create(dto);
  }

  @Patch('items/:menu_uuid')
  @RequirePermissions('navigation.manage')
  @ApiOperation({ summary: 'Update navigation item' })
  async updateItem(
    @Param('menu_uuid') menuUuid: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.navigationService.update(menuUuid, dto);
  }

  @Delete('items/:menu_uuid')
  @RequirePermissions('navigation.manage')
  @ApiOperation({ summary: 'Delete navigation item and cascade children' })
  async deleteItem(@Param('menu_uuid') menuUuid: string) {
    return this.navigationService.remove(menuUuid);
  }
}

