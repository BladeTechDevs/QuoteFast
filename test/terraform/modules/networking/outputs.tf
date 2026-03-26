output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "sg_alb_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "sg_ecs_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs.id
}

output "sg_rds_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "sg_lambda_id" {
  description = "ID of the Lambda security group"
  value       = aws_security_group.lambda.id
}
