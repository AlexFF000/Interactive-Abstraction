// Useful functions used in multiple files

function getObjectType(obj){  // Determine whether an object is an array or object
  if (obj.constructor == Array){
    return "array";
  }
  else{
    return "object";
  }
}
