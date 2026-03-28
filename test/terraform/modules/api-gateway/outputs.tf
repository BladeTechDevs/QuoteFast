output "api_gateway_id" {
  description = "ID of the API Gateway HTTP API"
  value       = aws_apigatewayv2_api.main.id
}

output "api_gateway_url" {
  description = "Invoke URL of the API Gateway (use as API base URL)"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "vpc_link_id" {
  description = "ID of the VPC Link"
  value       = aws_apigatewayv2_vpc_link.main.id
}
