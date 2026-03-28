# Auto-scaling deshabilitado — arquitectura de costo fijo con 1 tarea Fargate (730 h/mes)
# El estimado AWS está basado en 1 tarea continua. Para habilitar auto-scaling,
# descomentar los recursos a continuación y ajustar min_capacity / max_capacity.

# resource "aws_appautoscaling_target" "ecs" {
#   max_capacity       = var.max_capacity
#   min_capacity       = var.min_capacity
#   resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
#   scalable_dimension = "ecs:service:DesiredCount"
#   service_namespace  = "ecs"
# }

# resource "aws_appautoscaling_policy" "cpu_scale_out" {
#   name               = "${local.name_prefix}-cpu-scale-out"
#   policy_type        = "TargetTrackingScaling"
#   resource_id        = aws_appautoscaling_target.ecs.resource_id
#   scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
#   service_namespace  = aws_appautoscaling_target.ecs.service_namespace
#
#   target_tracking_scaling_policy_configuration {
#     predefined_metric_specification {
#       predefined_metric_type = "ECSServiceAverageCPUUtilization"
#     }
#     target_value       = 70.0
#     scale_in_cooldown  = 300
#     scale_out_cooldown = 60
#   }
# }
